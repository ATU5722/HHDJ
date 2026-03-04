package main

import (
  "crypto/hmac"
  "crypto/sha256"
  "database/sql"
  "encoding/hex"
  "encoding/json"
  "fmt"
  "io"
  "log"
  "net/http"
  "os"
  "path/filepath"
  "regexp"
  "strconv"
  "strings"
  "time"

  _ "modernc.org/sqlite"
)

type Config struct {
  Host         string
  Port         int
  DBPath       string
  APIKey       string
  SigWindowSec int64
  AdminToken   string
  WebRoot      string
}

type Server struct {
  cfg    Config
  db     *sql.DB
  dateRe *regexp.Regexp
}

type reportPayload struct {
  AccountID          string                       `json:"account_id"`
  ClientTimeUTC      string                       `json:"client_time_utc"`
  ReportDateUTC      string                       `json:"report_date_utc"`
  AadBStatus         string                       `json:"aadb_status"`
  IdempotencyKey     string                       `json:"idempotency_key"`
  MarketBalances     map[string]*int64            `json:"market_balances"`
  MarketBalanceSaved map[string]*int64            `json:"market_balance_saved_at"`
  AADBDailyByWorld   map[string]map[string]any    `json:"aadb_daily_by_world"`
}

func getenv(k, def string) string {
  v := strings.TrimSpace(os.Getenv(k))
  if v == "" {
    return def
  }
  return v
}

func getenvInt(k string, def int) int {
  v := strings.TrimSpace(os.Getenv(k))
  if v == "" {
    return def
  }
  n, err := strconv.Atoi(v)
  if err != nil {
    return def
  }
  return n
}

func loadConfig() Config {
  wd, _ := os.Getwd()
  return Config{
    Host:         getenv("HV_REPORT_HOST", "0.0.0.0"),
    Port:         getenvInt("HV_REPORT_PORT", 8080),
    DBPath:       getenv("HV_REPORT_DB", filepath.Join(wd, "data", "hv_report.db")),
    APIKey:       getenv("HV_REPORT_API_KEY", "hvtb_report_signing_key_v1_2026_03_04"),
    SigWindowSec: int64(getenvInt("HV_REPORT_SIG_WINDOW_SEC", 300)),
    AdminToken:   getenv("HV_REPORT_ADMIN_TOKEN", ""),
    WebRoot:      getenv("HV_REPORT_WEB_ROOT", filepath.Join(wd, "web")),
  }
}

func writeJSON(w http.ResponseWriter, code int, v any) {
  b, _ := json.Marshal(v)
  w.Header().Set("Content-Type", "application/json; charset=utf-8")
  w.Header().Set("Access-Control-Allow-Origin", "*")
  w.WriteHeader(code)
  _, _ = w.Write(b)
}

func ptrMapVal(m map[string]*int64, key string) any {
  if m == nil {
    return nil
  }
  v := m[key]
  if v == nil {
    return nil
  }
  return *v
}

func worldNum(world map[string]any, key string) int64 {
  v, ok := world[key]
  if !ok || v == nil {
    return 0
  }
  switch n := v.(type) {
  case float64:
    return int64(n)
  case int64:
    return n
  case int:
    return int64(n)
  default:
    return 0
  }
}

func worldStr(world map[string]any, key string) any {
  v, ok := world[key]
  if !ok || v == nil {
    return nil
  }
  s := strings.TrimSpace(fmt.Sprintf("%v", v))
  if s == "" {
    return nil
  }
  return s
}

func worldObjJSON(world map[string]any, key string) string {
  if world == nil {
    return "{}"
  }
  v, ok := world[key]
  if !ok || v == nil {
    return "{}"
  }
  b, _ := json.Marshal(v)
  if len(b) == 0 {
    return "{}"
  }
  return string(b)
}

func getEquips(world map[string]any) map[string]any {
  if world == nil {
    return map[string]any{}
  }
  v, ok := world["equips"]
  if !ok || v == nil {
    return map[string]any{}
  }
  m, ok := v.(map[string]any)
  if !ok {
    return map[string]any{}
  }
  return m
}

func (s *Server) checkAdmin(r *http.Request) bool {
  if s.cfg.AdminToken == "" {
    return true
  }
  token := strings.TrimSpace(r.Header.Get("X-Admin-Token"))
  if token != "" && token == s.cfg.AdminToken {
    return true
  }
  return strings.TrimSpace(r.URL.Query().Get("token")) == s.cfg.AdminToken
}

func mustInitDB(db *sql.DB) error {
  stmts := []string{
    "PRAGMA journal_mode=WAL;",
    "PRAGMA synchronous=NORMAL;",
    `CREATE TABLE IF NOT EXISTS account_latest (
      account_id TEXT PRIMARY KEY,
      market_main_balance INTEGER,
      market_isekai_balance INTEGER,
      market_main_saved_at INTEGER,
      market_isekai_saved_at INTEGER,
      updated_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS daily_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL,
      report_date_utc TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      client_time_utc TEXT,
      received_at INTEGER NOT NULL,
      aadb_status TEXT,

      main_rounds_total INTEGER,
      main_first_ar_start_time_utc TEXT,
      main_legendary_total INTEGER,
      main_peerless_total INTEGER,
      main_legendary_items_json TEXT,
      main_peerless_items_json TEXT,

      isekai_rounds_total INTEGER,
      isekai_first_ar_start_time_utc TEXT,
      isekai_legendary_total INTEGER,
      isekai_peerless_total INTEGER,
      isekai_legendary_items_json TEXT,
      isekai_peerless_items_json TEXT,

      UNIQUE(account_id, report_date_utc),
      UNIQUE(idempotency_key)
    );`,
    "CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(report_date_utc);",
    "CREATE INDEX IF NOT EXISTS idx_daily_metrics_account_date ON daily_metrics(account_id, report_date_utc);",
  }
  for _, stmt := range stmts {
    if _, err := db.Exec(stmt); err != nil {
      return err
    }
  }
  return nil
}

func (s *Server) handleReport(w http.ResponseWriter, r *http.Request) {
  if r.Method == http.MethodOptions {
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Header().Set("Access-Control-Allow-Methods", "POST,OPTIONS")
    w.Header().Set("Access-Control-Allow-Headers", "Content-Type,X-Account-Id,X-Timestamp,X-Signature")
    w.WriteHeader(http.StatusNoContent)
    return
  }
  if r.Method != http.MethodPost {
    writeJSON(w, 405, map[string]string{"error": "method_not_allowed"})
    return
  }

  raw, err := io.ReadAll(io.LimitReader(r.Body, 2<<20))
  if err != nil {
    writeJSON(w, 400, map[string]string{"error": "read_body_failed"})
    return
  }
  rawBody := string(raw)

  headerAccount := strings.TrimSpace(r.Header.Get("X-Account-Id"))
  tsStr := strings.TrimSpace(r.Header.Get("X-Timestamp"))
  sig := strings.ToLower(strings.TrimSpace(r.Header.Get("X-Signature")))
  if headerAccount == "" || tsStr == "" || sig == "" {
    writeJSON(w, 401, map[string]string{"error": "missing_signature_headers"})
    return
  }

  tsMs, err := strconv.ParseInt(tsStr, 10, 64)
  if err != nil {
    writeJSON(w, 401, map[string]string{"error": "invalid_timestamp"})
    return
  }
  nowMs := time.Now().UnixMilli()
  if abs64(nowMs-tsMs) > s.cfg.SigWindowSec*1000 {
    writeJSON(w, 401, map[string]string{"error": "timestamp_out_of_window"})
    return
  }

  mac := hmac.New(sha256.New, []byte(s.cfg.APIKey))
  _, _ = mac.Write([]byte(tsStr + "." + rawBody))
  expected := hex.EncodeToString(mac.Sum(nil))
  if !hmac.Equal([]byte(expected), []byte(sig)) {
    writeJSON(w, 401, map[string]string{"error": "bad_signature"})
    return
  }

  var p reportPayload
  if err := json.Unmarshal(raw, &p); err != nil {
    writeJSON(w, 422, map[string]string{"error": "invalid_json"})
    return
  }
  p.AccountID = strings.TrimSpace(p.AccountID)
  p.ReportDateUTC = strings.TrimSpace(p.ReportDateUTC)
  p.IdempotencyKey = strings.TrimSpace(p.IdempotencyKey)
  if p.AccountID == "" || p.AccountID != headerAccount {
    writeJSON(w, 422, map[string]string{"error": "account_mismatch"})
    return
  }
  if !s.dateRe.MatchString(p.ReportDateUTC) {
    writeJSON(w, 422, map[string]string{"error": "invalid_report_date"})
    return
  }
  if p.IdempotencyKey == "" {
    p.IdempotencyKey = p.AccountID + ":" + p.ReportDateUTC
  }

  nowSec := time.Now().Unix()
  main := p.AADBDailyByWorld["main"]
  isekai := p.AADBDailyByWorld["isekai"]
  mainEq := getEquips(main)
  isekaiEq := getEquips(isekai)

  tx, err := s.db.Begin()
  if err != nil {
    writeJSON(w, 500, map[string]string{"error": "db_begin_failed"})
    return
  }
  defer tx.Rollback()

  _, err = tx.Exec(
    `INSERT INTO account_latest (
      account_id, market_main_balance, market_isekai_balance,
      market_main_saved_at, market_isekai_saved_at, updated_at
    ) VALUES (?,?,?,?,?,?)
    ON CONFLICT(account_id) DO UPDATE SET
      market_main_balance=excluded.market_main_balance,
      market_isekai_balance=excluded.market_isekai_balance,
      market_main_saved_at=excluded.market_main_saved_at,
      market_isekai_saved_at=excluded.market_isekai_saved_at,
      updated_at=excluded.updated_at`,
    p.AccountID,
    ptrMapVal(p.MarketBalances, "main"),
    ptrMapVal(p.MarketBalances, "isekai"),
    ptrMapVal(p.MarketBalanceSaved, "main"),
    ptrMapVal(p.MarketBalanceSaved, "isekai"),
    nowSec,
  )
  if err != nil {
    writeJSON(w, 500, map[string]string{"error": "db_upsert_latest_failed"})
    return
  }

  _, err = tx.Exec(
    `INSERT INTO daily_metrics (
      account_id, report_date_utc, idempotency_key, client_time_utc, received_at, aadb_status,
      main_rounds_total, main_first_ar_start_time_utc, main_legendary_total, main_peerless_total,
      main_legendary_items_json, main_peerless_items_json,
      isekai_rounds_total, isekai_first_ar_start_time_utc, isekai_legendary_total, isekai_peerless_total,
      isekai_legendary_items_json, isekai_peerless_items_json
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(account_id, report_date_utc) DO UPDATE SET
      idempotency_key=excluded.idempotency_key,
      client_time_utc=excluded.client_time_utc,
      received_at=excluded.received_at,
      aadb_status=excluded.aadb_status,
      main_rounds_total=excluded.main_rounds_total,
      main_first_ar_start_time_utc=excluded.main_first_ar_start_time_utc,
      main_legendary_total=excluded.main_legendary_total,
      main_peerless_total=excluded.main_peerless_total,
      main_legendary_items_json=excluded.main_legendary_items_json,
      main_peerless_items_json=excluded.main_peerless_items_json,
      isekai_rounds_total=excluded.isekai_rounds_total,
      isekai_first_ar_start_time_utc=excluded.isekai_first_ar_start_time_utc,
      isekai_legendary_total=excluded.isekai_legendary_total,
      isekai_peerless_total=excluded.isekai_peerless_total,
      isekai_legendary_items_json=excluded.isekai_legendary_items_json,
      isekai_peerless_items_json=excluded.isekai_peerless_items_json`,
    p.AccountID,
    p.ReportDateUTC,
    p.IdempotencyKey,
    p.ClientTimeUTC,
    nowSec,
    p.AadBStatus,
    worldNum(main, "rounds_total"),
    worldStr(main, "first_ar_start_time_utc"),
    worldNum(mainEq, "legendary_total"),
    worldNum(mainEq, "peerless_total"),
    worldObjJSON(mainEq, "legendary_items"),
    worldObjJSON(mainEq, "peerless_items"),
    worldNum(isekai, "rounds_total"),
    worldStr(isekai, "first_ar_start_time_utc"),
    worldNum(isekaiEq, "legendary_total"),
    worldNum(isekaiEq, "peerless_total"),
    worldObjJSON(isekaiEq, "legendary_items"),
    worldObjJSON(isekaiEq, "peerless_items"),
  )
  if err != nil {
    writeJSON(w, 500, map[string]string{"error": "db_upsert_daily_failed"})
    return
  }

  if err := tx.Commit(); err != nil {
    writeJSON(w, 500, map[string]string{"error": "db_commit_failed"})
    return
  }

  writeJSON(w, 201, map[string]string{"status": "ok"})
}

func (s *Server) handleAccountsLatest(w http.ResponseWriter, r *http.Request) {
  if !s.checkAdmin(r) {
    writeJSON(w, 401, map[string]string{"error": "unauthorized"})
    return
  }
  rows, err := s.db.Query(
    `SELECT account_id, market_main_balance, market_isekai_balance,
            market_main_saved_at, market_isekai_saved_at, updated_at
       FROM account_latest
      ORDER BY account_id ASC`,
  )
  if err != nil {
    writeJSON(w, 500, map[string]string{"error": "db_query_failed"})
    return
  }
  defer rows.Close()

  items := make([]map[string]any, 0)
  for rows.Next() {
    var accountID string
    var mm, mi, msm, msi sql.NullInt64
    var updatedAt int64
    if err := rows.Scan(&accountID, &mm, &mi, &msm, &msi, &updatedAt); err != nil {
      writeJSON(w, 500, map[string]string{"error": "db_scan_failed"})
      return
    }
    items = append(items, map[string]any{
      "account_id":            accountID,
      "market_main_balance":   nullIntToAny(mm),
      "market_isekai_balance": nullIntToAny(mi),
      "market_main_saved_at":  nullIntToAny(msm),
      "market_isekai_saved_at": nullIntToAny(msi),
      "updated_at":            updatedAt,
    })
  }
  writeJSON(w, 200, map[string]any{"items": items})
}

func (s *Server) handleAccountDaily(w http.ResponseWriter, r *http.Request) {
  if !s.checkAdmin(r) {
    writeJSON(w, 401, map[string]string{"error": "unauthorized"})
    return
  }
  prefix := "/api/v1/admin/account/"
  suffix := "/daily"
  if !strings.HasPrefix(r.URL.Path, prefix) {
    writeJSON(w, 404, map[string]string{"error": "not_found"})
    return
  }

  if r.Method == http.MethodDelete {
    accountID := strings.Trim(strings.TrimPrefix(r.URL.Path, prefix), "/ ")
    if accountID == "" || strings.Contains(accountID, "/") {
      writeJSON(w, 422, map[string]string{"error": "invalid_account"})
      return
    }
    tx, err := s.db.Begin()
    if err != nil {
      writeJSON(w, 500, map[string]string{"error": "db_begin_failed"})
      return
    }
    defer tx.Rollback()

    resLatest, err := tx.Exec("DELETE FROM account_latest WHERE account_id = ?", accountID)
    if err != nil {
      writeJSON(w, 500, map[string]string{"error": "db_delete_latest_failed"})
      return
    }
    resDaily, err := tx.Exec("DELETE FROM daily_metrics WHERE account_id = ?", accountID)
    if err != nil {
      writeJSON(w, 500, map[string]string{"error": "db_delete_daily_failed"})
      return
    }
    if err := tx.Commit(); err != nil {
      writeJSON(w, 500, map[string]string{"error": "db_commit_failed"})
      return
    }

    latestRows, _ := resLatest.RowsAffected()
    dailyRows, _ := resDaily.RowsAffected()
    writeJSON(w, 200, map[string]any{
      "status": "deleted",
      "account_id": accountID,
      "latest_deleted": latestRows,
      "daily_deleted": dailyRows,
    })
    return
  }

  if r.Method != http.MethodGet || !strings.HasSuffix(r.URL.Path, suffix) {
    writeJSON(w, 405, map[string]string{"error": "method_not_allowed"})
    return
  }

  accountID := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, prefix), suffix)
  accountID = strings.Trim(accountID, "/ ")
  if accountID == "" {
    writeJSON(w, 422, map[string]string{"error": "invalid_account"})
    return
  }

  from := strings.TrimSpace(r.URL.Query().Get("from"))
  to := strings.TrimSpace(r.URL.Query().Get("to"))
  if from != "" && !s.dateRe.MatchString(from) {
    writeJSON(w, 422, map[string]string{"error": "invalid_from"})
    return
  }
  if to != "" && !s.dateRe.MatchString(to) {
    writeJSON(w, 422, map[string]string{"error": "invalid_to"})
    return
  }

  where := []string{"account_id = ?"}
  args := []any{accountID}
  if from != "" {
    where = append(where, "report_date_utc >= ?")
    args = append(args, from)
  }
  if to != "" {
    where = append(where, "report_date_utc <= ?")
    args = append(args, to)
  }

  q := fmt.Sprintf(
    `SELECT report_date_utc, received_at, aadb_status,
            main_rounds_total, main_first_ar_start_time_utc, main_legendary_total, main_peerless_total,
            main_legendary_items_json, main_peerless_items_json,
            isekai_rounds_total, isekai_first_ar_start_time_utc, isekai_legendary_total, isekai_peerless_total,
            isekai_legendary_items_json, isekai_peerless_items_json
       FROM daily_metrics
      WHERE %s
      ORDER BY report_date_utc DESC`,
    strings.Join(where, " AND "),
  )

  rows, err := s.db.Query(q, args...)
  if err != nil {
    writeJSON(w, 500, map[string]string{"error": "db_query_failed"})
    return
  }
  defer rows.Close()

  items := make([]map[string]any, 0)
  for rows.Next() {
    var date string
    var receivedAt int64
    var status sql.NullString
    var mRounds, mLegend, mPeer, iRounds, iLegend, iPeer sql.NullInt64
    var mFirst, iFirst, mLi, mPi, iLi, iPi sql.NullString
    if err := rows.Scan(
      &date, &receivedAt, &status,
      &mRounds, &mFirst, &mLegend, &mPeer,
      &mLi, &mPi,
      &iRounds, &iFirst, &iLegend, &iPeer,
      &iLi, &iPi,
    ); err != nil {
      writeJSON(w, 500, map[string]string{"error": "db_scan_failed"})
      return
    }
    items = append(items, map[string]any{
      "report_date_utc":               date,
      "received_at":                   receivedAt,
      "aadb_status":                   nullStringToAny(status),
      "main_rounds_total":             nullIntToAny(mRounds),
      "main_first_ar_start_time_utc":  nullStringToAny(mFirst),
      "main_legendary_total":          nullIntToAny(mLegend),
      "main_peerless_total":           nullIntToAny(mPeer),
      "main_legendary_items_json":     nullStringOrDefault(mLi, "{}"),
      "main_peerless_items_json":      nullStringOrDefault(mPi, "{}"),
      "isekai_rounds_total":           nullIntToAny(iRounds),
      "isekai_first_ar_start_time_utc": nullStringToAny(iFirst),
      "isekai_legendary_total":        nullIntToAny(iLegend),
      "isekai_peerless_total":         nullIntToAny(iPeer),
      "isekai_legendary_items_json":   nullStringOrDefault(iLi, "{}"),
      "isekai_peerless_items_json":    nullStringOrDefault(iPi, "{}"),
    })
  }

  writeJSON(w, 200, map[string]any{"account_id": accountID, "items": items})
}

func (s *Server) serveStatic(w http.ResponseWriter, r *http.Request) {
  if strings.HasPrefix(r.URL.Path, "/api/") {
    writeJSON(w, 404, map[string]string{"error": "not_found"})
    return
  }
  p := r.URL.Path
  if p == "/" {
    p = "/index.html"
  }
  clean := filepath.Clean(strings.TrimPrefix(p, "/"))
  if strings.HasPrefix(clean, "..") {
    http.NotFound(w, r)
    return
  }
  fp := filepath.Join(s.cfg.WebRoot, clean)
  st, err := os.Stat(fp)
  if err != nil || st.IsDir() {
    http.NotFound(w, r)
    return
  }
  http.ServeFile(w, r, fp)
}

func nullIntToAny(v sql.NullInt64) any {
  if !v.Valid {
    return nil
  }
  return v.Int64
}

func nullStringToAny(v sql.NullString) any {
  if !v.Valid {
    return nil
  }
  s := strings.TrimSpace(v.String)
  if s == "" {
    return nil
  }
  return s
}

func nullStringOrDefault(v sql.NullString, def string) string {
  if !v.Valid {
    return def
  }
  s := strings.TrimSpace(v.String)
  if s == "" {
    return def
  }
  return s
}

func emptyToNil(v string) any {
  s := strings.TrimSpace(v)
  if s == "" {
    return nil
  }
  return s
}

func abs64(v int64) int64 {
  if v < 0 {
    return -v
  }
  return v
}

func run() error {
  cfg := loadConfig()
  if cfg.APIKey == "" {
    return fmt.Errorf("HV_REPORT_API_KEY is required")
  }

  if err := os.MkdirAll(filepath.Dir(cfg.DBPath), 0o755); err != nil {
    return err
  }
  if err := os.MkdirAll(cfg.WebRoot, 0o755); err != nil {
    return err
  }

  db, err := sql.Open("sqlite", cfg.DBPath)
  if err != nil {
    return err
  }
  db.SetMaxOpenConns(1)
  db.SetMaxIdleConns(1)
  db.SetConnMaxLifetime(0)

  if err := mustInitDB(db); err != nil {
    return err
  }

  s := &Server{cfg: cfg, db: db, dateRe: regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)}
  mux := http.NewServeMux()
  mux.HandleFunc("/api/v1/report/daily", s.handleReport)
  mux.HandleFunc("/api/v1/admin/accounts", s.handleAccountsLatest)
  mux.HandleFunc("/api/v1/admin/account/", s.handleAccountDaily)
  mux.HandleFunc("/", s.serveStatic)

  addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
  log.Printf("hv-report server listening on %s", addr)
  return http.ListenAndServe(addr, mux)
}

func main() {
  if err := run(); err != nil {
    log.Fatalf("start failed: %v", err)
  }
}
