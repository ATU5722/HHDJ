#!/bin/bash
###########################################################################################
#                                                                                         #
#   一键远程桌面 & 浏览器访问部署脚本 v0.4.0                                                 #
#                                                                                         #
#   【功能说明】                                                                           #
#   本脚本用于在 Ubuntu 24.04 或 Debian 12 服务器上一键部署可通过浏览器访问的远程桌面环境。  #
#   部署完成后，你可以通过任意浏览器访问服务器的域名，直接使用完整的远程桌面。               #
#                                                                                         #
#   【具体组件】                                                                           #
#   - Apache Guacamole：基于 HTML5 的远程桌面网关（浏览器端无需安装任何插件）                #
#   - XRDP + Openbox：远程桌面协议服务 + 轻量级窗口管理器                                       #
#   - Apache Tomcat 9：运行 Guacamole Web 应用的 Java 容器                                  #
#   - Nginx：反向代理，将域名指向 Guacamole 服务                                            #
#   - Let's Encrypt：自动申请免费 SSL 证书，提供 HTTPS 加密访问                             #
#   - Chromium：在远程桌面内可直接使用的浏览器                                         #
#                                                                                         #
#   【使用方法】                                                                           #
#   1. 以 root 用户运行此脚本：bash 1CD.sh                                                  #
#   2. 脚本会提示输入域名（如 desktop.example.com），请提前将域名 DNS 解析到服务器 IP        #
#   3. 脚本将自动安装所有依赖和组件，全程无需人工干预                                        #
#   4. 安装完成后，通过浏览器访问 https://你的域名 即可进入远程桌面                          #
#   5. Guacamole 用户名/密码默认为 atu/atu，进入后再用系统用户 atu/atu 登录 XRDP             #
#                                                                                         #
#   【注意事项】                                                                           #
#   - 服务器至少需要 1 GB 内存                                                             #
#   - 仅支持 Ubuntu 24.04 和 Debian 12，其他系统请自行承担风险                              #
#   - 原作者：shc (https://qing.su)，项目地址：https://github.com/Har-Kuun/OneClickDesktop  #
#                                                                                         #
###########################################################################################


# 可在此修改 Guacamole 源码下载链接
# 最新稳定版本请查看 https://guacamole.apache.org/releases/

GUACAMOLE_DOWNLOAD_LINK="https://dlcdn.apache.org/guacamole/1.5.5/source/guacamole-server-1.5.5.tar.gz"
GUACAMOLE_VERSION="1.5.5"

# 默认仅支持 Ubuntu 24 和 Debian 12
# 将下方 OS_CHECK_ENABLED 设为 OFF 可跳过系统版本检查，在其他系统上尝试安装
# 注意：在非支持的 OS 上运行可能导致系统损坏，安装前请备份服务器

OS_CHECK_ENABLED=ON




#########################################################################
#    Functions start here.                                              #
#    Do not change anything below unless you know what you are doing.   #
#########################################################################

exec > >(tee -i OneClickDesktop.log)
exec 2>&1

function check_OS
{
	if [ -f /etc/lsb-release ] ; then
		cat /etc/lsb-release | grep "DISTRIB_RELEASE=24." >/dev/null
		if [ $? = 0 ] ; then
			OS=UBUNTU24
		else
			say "Sorry, this script only supports Ubuntu 24 and Debian 12." red
			echo 
			exit 1
		fi
	elif [ -f /etc/debian_version ] ; then
		cat /etc/debian_version | grep "^12." >/dev/null
		if [ $? = 0 ] ; then
			OS=DEBIAN12
		else
			say "Sorry, this script only supports Ubuntu 24 and Debian 12." red
			echo 
			exit 1
		fi
	else
		say "Sorry, this script only supports Ubuntu 24 and Debian 12." red
		echo 
		exit 1
	fi
}

function say
{
#This function is a colored version of the built-in "echo."
#https://github.com/Har-Kuun/useful-shell-functions/blob/master/colored-echo.sh
	echo_content=$1
	case $2 in
		black | k ) colorf=0 ;;
		red | r ) colorf=1 ;;
		green | g ) colorf=2 ;;
		yellow | y ) colorf=3 ;;
		blue | b ) colorf=4 ;;
		magenta | m ) colorf=5 ;;
		cyan | c ) colorf=6 ;;
		white | w ) colorf=7 ;;
		* ) colorf=N ;;
	esac
	case $3 in
		black | k ) colorb=0 ;;
		red | r ) colorb=1 ;;
		green | g ) colorb=2 ;;
		yellow | y ) colorb=3 ;;
		blue | b ) colorb=4 ;;
		magenta | m ) colorb=5 ;;
		cyan | c ) colorb=6 ;;
		white | w ) colorb=7 ;;
		* ) colorb=N ;;
	esac
	if [ "x${colorf}" != "xN" ] ; then
		tput setaf $colorf
	fi
	if [ "x${colorb}" != "xN" ] ; then
		tput setab $colorb
	fi
	printf "${echo_content}" | sed -e "s/@B/$(tput bold)/g"
	tput sgr 0
	printf "\n"
}

function determine_system_variables
{
	CurrentUser="$(id -u -n)"
	CurrentDir=$(pwd)
	HomeDir=$HOME
}

function get_user_options
{
	echo
	say @B"Using fixed installation profile..." yellow

	guacamole_username=atu
	guacamole_password_prehash=atu
	read guacamole_password_md5 <<< $(echo -n $guacamole_password_prehash | md5sum | awk '{print $1}')

	rdp_screen_width=1280
	rdp_screen_height=800

	confirm_letsencrypt=Y
	le_email=zshyydyx@163.com

	echo
	say @B"Please input your domain name (e.g., desktop.example.com):" yellow
	read guacamole_hostname

	echo
	say @B"Installation will start now.  Please wait." green
	sleep 2
}	

function install_guacamole_ubuntu_debian
{
	echo 
	say @B"Setting up dependencies..." yellow
	echo 
	apt-get update
	if [ "$OS" = "UBUNTU24" ] ; then
		apt-get install libjpeg-turbo8-dev language-pack-zh* -y
		apt-get install wget curl gcc sudo zip unzip tar perl expect build-essential libcairo2-dev libpng-dev libtool-bin libossp-uuid-dev libvncserver-dev freerdp2-dev libssh2-1-dev libtelnet-dev libwebsockets-dev libpulse-dev libvorbis-dev libwebp-dev libssl-dev libpango1.0-dev libswscale-dev libavcodec-dev libavutil-dev libavformat-dev chinese* fonts-arphic-ukai fonts-arphic-uming -y
		install_tomcat9_ubuntu
	else
		apt-get install libjpeg62-turbo-dev -y
		apt-get install wget curl gcc sudo zip unzip tar perl expect build-essential libcairo2-dev libpng-dev libtool-bin libossp-uuid-dev libvncserver-dev freerdp2-dev libssh2-1-dev libtelnet-dev libwebsockets-dev libpulse-dev libvorbis-dev libwebp-dev libssl-dev libpango1.0-dev libswscale-dev libavcodec-dev libavutil-dev libavformat-dev chinese* fonts-arphic-ukai fonts-arphic-uming -y
		install_tomcat9_debian
	fi
	
	wget $GUACAMOLE_DOWNLOAD_LINK
	tar zxf guacamole-server-${GUACAMOLE_VERSION}.tar.gz
	rm -f guacamole-server-${GUACAMOLE_VERSION}.tar.gz
	cd $CurrentDir/guacamole-server-$GUACAMOLE_VERSION
	echo "Start building Guacamole Server from source..."
	./configure --with-init-dir=/etc/init.d
	if [ -f $CurrentDir/guacamole-server-$GUACAMOLE_VERSION/config.status ] ; then
		say @B"Dependencies met!" green
		say @B"Compiling now..." green
		echo
	else
		echo 
		say "Missing dependencies." red
		echo "Please check log, install required dependencies, and run this script again."
		echo "Please also consider to report your log here https://github.com/Har-Kuun/OneClickDesktop/issues so that I can fix this issue."
		echo "Thank you!"
		echo 
		exit 1
	fi
	sleep 2
	make
	make install
	ldconfig
	echo "Trying to start Guacamole Server for the first time..."
	echo "This can take a while..."
	echo 
	systemctl daemon-reload
	systemctl start guacd
	systemctl enable guacd
	ss -lnpt | grep guacd >/dev/null
	if [ $? = 0 ] ; then
		say @B"Guacamole Server successfully installed!" green
		echo 
	else 
		say "Guacamole Server installation failed." red
		say @B"Please check the above log for reasons." yellow
		echo "Please also consider to report your log here https://github.com/Har-Kuun/OneClickDesktop/issues so that I can fix this issue."
		echo "Thank you!"
		exit 1
	fi
}

function install_tomcat9_ubuntu
{
	apt-get install default-jre default-jdk -y
	curl -s https://archive.apache.org/dist/tomcat/tomcat-9/v9.0.38/bin/apache-tomcat-9.0.38.tar.gz | tar -xz
	mv apache-tomcat-9.0.38 /etc/tomcat9
	useradd -r tomcat
	chown -R tomcat:tomcat /etc/tomcat9
	rm -rf /etc/tomcat9/webapps/docs /etc/tomcat9/webapps/examples /etc/tomcat9/webapps/host-manager /etc/tomcat9/webapps/manager /etc/tomcat9/webapps/ROOT
	sed -i 's|port="8080" protocol="HTTP/1.1"|port="8080" address="127.0.0.1" protocol="HTTP/1.1"|' /etc/tomcat9/conf/server.xml
	cat > /etc/systemd/system/tomcat9.service <<END
[Unit]
Description=Apache Tomcat Server
After=syslog.target network.target

[Service]
Type=forking
User=tomcat
Group=tomcat

Environment=JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
Environment=CATALINA_PID=/etc/tomcat9/temp/tomcat.pid
Environment=CATALINA_HOME=/etc/tomcat9
Environment=CATALINA_OPTS=-Xmx256m -Xms128m -XX:+UseSerialGC -XX:-UsePerfData
Environment=CATALINA_BASE=/etc/tomcat9

ExecStart=/etc/tomcat9/bin/catalina.sh start
ExecStop=/etc/tomcat9/bin/catalina.sh stop

RestartSec=10
Restart=on-failure
OOMScoreAdjust=-500
[Install]
WantedBy=multi-user.target
END
	systemctl daemon-reload
	systemctl start tomcat9
	systemctl enable tomcat9
}


function install_tomcat9_debian
{
	apt-get install default-jre default-jdk -y
	curl -s https://archive.apache.org/dist/tomcat/tomcat-9/v9.0.38/bin/apache-tomcat-9.0.38.tar.gz | tar -xz
	mv apache-tomcat-9.0.38 /etc/tomcat9
	useradd -r tomcat
	chown -R tomcat:tomcat /etc/tomcat9
	rm -rf /etc/tomcat9/webapps/docs /etc/tomcat9/webapps/examples /etc/tomcat9/webapps/host-manager /etc/tomcat9/webapps/manager /etc/tomcat9/webapps/ROOT
	sed -i 's|port="8080" protocol="HTTP/1.1"|port="8080" address="127.0.0.1" protocol="HTTP/1.1"|' /etc/tomcat9/conf/server.xml
	cat > /etc/systemd/system/tomcat9.service <<END
[Unit]
Description=Apache Tomcat Server
After=syslog.target network.target

[Service]
Type=forking
User=tomcat
Group=tomcat

Environment=JAVA_HOME=/usr/lib/jvm/java-1.17.0-openjdk-amd64
Environment=CATALINA_PID=/etc/tomcat9/temp/tomcat.pid
Environment=CATALINA_HOME=/etc/tomcat9
Environment=CATALINA_OPTS=-Xmx256m -Xms128m -XX:+UseSerialGC -XX:-UsePerfData
Environment=CATALINA_BASE=/etc/tomcat9

ExecStart=/etc/tomcat9/bin/catalina.sh start
ExecStop=/etc/tomcat9/bin/catalina.sh stop

RestartSec=10
Restart=on-failure
OOMScoreAdjust=-500
[Install]
WantedBy=multi-user.target
END
	systemctl daemon-reload
	systemctl start tomcat9
	systemctl enable tomcat9
}
	
function install_guacamole_web
{
	echo 
	echo "Start installing Guacamole Web Application..."
	cd $CurrentDir
	wget https://downloads.apache.org/guacamole/$GUACAMOLE_VERSION/binary/guacamole-$GUACAMOLE_VERSION.war
	mv guacamole-$GUACAMOLE_VERSION.war /etc/tomcat9/webapps/guacamole.war
	systemctl restart tomcat9 guacd
	
	echo 
	say @B"Guacamole Web Application successfully installed!" green
	echo 
}

function enforce_guacd_ipv4
{
	echo
	say @B"Ensuring GUACD uses IPv4 loopback..." yellow

	if [ -x /usr/local/sbin/guacd ] ; then
		guacd_bin=/usr/local/sbin/guacd
	else
		read guacd_bin <<< $(command -v guacd)
	fi

	if [ -z "$guacd_bin" ] ; then
		say "GUACD binary not found, skipping IPv4 override." red
		return
	fi

	mkdir -p /etc/systemd/system/guacd.service.d
	cat > /etc/systemd/system/guacd.service.d/override.conf <<END
[Service]
ExecStart=
Type=simple
ExecStart=$guacd_bin -f -b 127.0.0.1 -l 4822
Restart=on-failure
RestartSec=5
OOMScoreAdjust=-500
END

	systemctl daemon-reload
	systemctl restart guacd

	ss -lnpt | grep "127.0.0.1:4822" >/dev/null
	if [ $? = 0 ] ; then
		say @B"GUACD now listens on 127.0.0.1:4822." green
	else
		say "GUACD IPv4 override may not be active yet." red
	fi
}

function configure_guacamole_ubuntu_debian
{
	echo 
	mkdir /etc/guacamole/
	cat > /etc/guacamole/guacamole.properties <<END
guacd-hostname: 127.0.0.1
guacd-port: 4822
auth-provider: net.sourceforge.guacamole.net.basic.BasicFileAuthenticationProvider
basic-user-mapping: /etc/guacamole/user-mapping.xml
END
	cat > /etc/guacamole/user-mapping.xml <<END
<user-mapping>
    <authorize
         username="$guacamole_username"
         password="$guacamole_password_md5"
         encoding="md5">      
       <connection name="default">
         <protocol>rdp</protocol>
         <param name="hostname">localhost</param>
         <param name="port">3389</param>
		 <param name="width">$rdp_screen_width</param>
		 <param name="height">$rdp_screen_height</param>
        </connection>
     </authorize>
</user-mapping>
END
	systemctl restart tomcat9 guacd
	say @B"Guacamole successfully configured!" green
	echo 
}

function install_rdp
{
	echo 
	echo "Starting to install desktop and XRDP server..."
	if [ "$OS" = "UBUNTU24" ] ; then
		say @B"Disabling unnecessary LightDM display manager..." yellow
	fi
	apt-get install xfce4 xrdp -y
	mkdir -p /etc/systemd/system/xrdp.service.d
	cat > /etc/systemd/system/xrdp.service.d/oom.conf <<END
[Service]
OOMScoreAdjust=-500
END
	systemctl daemon-reload
	if [ "$OS" = "UBUNTU24" ] ; then
		systemctl disable lightdm 2>/dev/null || true
		systemctl stop lightdm 2>/dev/null || true
t		apt purge gnome-session-bin gnome-session-common gnome-initial-setup evolution-data-server -y 2>/dev/null || true
	fi
	say @B"XFCE4 desktop and XRDP server successfully installed." green
	echo "Starting to configure XRDP server..."
	sleep 2
	echo 
	mv /etc/xrdp/startwm.sh /etc/xrdp/startwm.sh.backup
	cat > /etc/xrdp/startwm.sh <<END
#!/bin/sh
# xrdp X session start script (c) 2015, 2017 mirabilos
# published under The MirOS Licence

if test -r /etc/profile; then
        . /etc/profile
fi

if test -r /etc/default/locale; then
        . /etc/default/locale
        test -z "${LANG+x}" || export LANG
        test -z "${LANGUAGE+x}" || export LANGUAGE
        test -z "${LC_ADDRESS+x}" || export LC_ADDRESS
        test -z "${LC_ALL+x}" || export LC_ALL
        test -z "${LC_COLLATE+x}" || export LC_COLLATE
        test -z "${LC_CTYPE+x}" || export LC_CTYPE
        test -z "${LC_IDENTIFICATION+x}" || export LC_IDENTIFICATION
        test -z "${LC_MEASUREMENT+x}" || export LC_MEASUREMENT
        test -z "${LC_MESSAGES+x}" || export LC_MESSAGES
        test -z "${LC_MONETARY+x}" || export LC_MONETARY
        test -z "${LC_NAME+x}" || export LC_NAME
        test -z "${LC_NUMERIC+x}" || export LC_NUMERIC
        test -z "${LC_PAPER+x}" || export LC_PAPER
        test -z "${LC_TELEPHONE+x}" || export LC_TELEPHONE
        test -z "${LC_TIME+x}" || export LC_TIME
        test -z "${LOCPATH+x}" || export LOCPATH
fi


 xfce4-session

test -x /etc/X11/Xsession && exec /etc/X11/Xsession
exec /bin/sh /etc/X11/Xsession

END
	chmod +x /etc/xrdp/startwm.sh
	systemctl restart xrdp
	sleep 5
	echo "Waiting to start XRDP server..."
	ss -lnpt | grep xrdp > /dev/null
	if [ $? = 0 ] ; then
		ss -lnpt | grep guacd > /dev/null
		if [ $? = 0 ] ; then
			say @B"XRDP and XFCE4 desktop successfully configured!" green
		else 
			say @B"XRDP and XFCE4 desktop successfully configured!" green
			sleep 3
			systemctl start guacd
		fi
		echo 
	else
		say "XRDP installation failed!" red
		say @B"Please check the above log for reasons." yellow
		echo "Please also consider to report your log here https://github.com/Har-Kuun/OneClickDesktop/issues so that I can fix this issue."
		echo "Thank you!"
		exit 1
	fi
}

function display_license
{
	echo 
	echo '*******************************************************************'
	echo '*       One-click Desktop & Browser Access Setup Script           *'
	echo '*       Version 0.4.0                                             *'
	echo '*       Author: shc (Har-Kuun) https://qing.su                    *'
	echo '*       https://github.com/Har-Kuun/OneClickDesktop               *'
	echo '*       Thank you for using this script.  E-mail: hi@qing.su      *'
	echo '*******************************************************************'
	echo 
}

function install_reverse_proxy
{
	echo 
	say @B"Setting up Nginx reverse proxy..." yellow
	sleep 2
	apt-get install nginx certbot python3-certbot-nginx -y
	sed -i 's/worker_connections [0-9]*;/worker_connections 256;/' /etc/nginx/nginx.conf
	say @B"Nginx successfully installed!" green
		cat > /etc/nginx/conf.d/guacamole.conf <<END
limit_req_zone \$binary_remote_addr zone=guac_login:1m rate=5r/s;
limit_conn_zone \$binary_remote_addr zone=guac_conn:1m;

server {
        listen 80;
        listen [::]:80;
        server_name $guacamole_hostname;

        access_log  off;
        error_log  /var/log/nginx/guac_error.log;

        limit_req   zone=guac_login burst=10 nodelay;
        limit_conn  guac_conn 10;

        location / {
                    proxy_pass http://127.0.0.1:8080/guacamole/;
                    proxy_buffering off;
                    proxy_http_version 1.1;
                    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
                    proxy_set_header Upgrade \$http_upgrade;
                    proxy_set_header Connection \$http_connection;
                    proxy_cookie_path /guacamole/ /;
        }

}
END
	systemctl reload nginx
	if [ "x$confirm_letsencrypt" = "xY" ] || [ "x$confirm_letsencrypt" = "xy" ] ; then
		certbot --nginx --agree-tos --redirect --hsts --email $le_email -d $guacamole_hostname
		echo 
		if [ -f /etc/letsencrypt/live/$guacamole_hostname/fullchain.pem ] ; then
			say @B"Congratulations! Let's Encrypt SSL certificate installed successfully!" green
			say @B"You can now access your desktop at https://${guacamole_hostname}!" green
		else
			say "Oops! Let's Encrypt SSL certificate installation failed." red
			say @B"Please manually try \"certbot --nginx --agree-tos --redirect --hsts --staple-ocsp --email $le_email -d $guacamole_hostname\"." yellow
			say @B"You can now access your desktop at http://${guacamole_hostname}!" green
		fi
	else
		say @B"Let's Encrypt certificate not installed! If you would like to install a Let's Encrypt certificate later, please manually run \"certbot --nginx --agree-tos --redirect --hsts --staple-ocsp -d $guacamole_hostname\"." yellow
		say @B"You can now access your desktop at http://${guacamole_hostname}!" green
	fi
	say @B"Your Guacamole username is $guacamole_username and your Guacamole password is $guacamole_password_prehash." green
}

function setup_atu_user
{
	echo
	say @B"Creating and configuring Linux user atu..." yellow

	if id -u atu >/dev/null 2>&1 ; then
		usermod -s /bin/bash atu
	else
		useradd -m -s /bin/bash atu
	fi

	echo 'atu:atu' | chpasswd
	usermod -aG sudo atu

	cat > /etc/sudoers.d/90-atu <<END
atu ALL=(ALL:ALL) NOPASSWD: ALL
END
	chmod 440 /etc/sudoers.d/90-atu

	visudo -cf /etc/sudoers.d/90-atu >/dev/null
	if [ $? != 0 ] ; then
		say "Invalid sudoers entry for atu." red
		exit 1
	fi

	say @B"Linux user atu configured with sudo privileges." green
	say @B"If atu is already logged in, re-login is required for sudo group refresh." yellow

	# Disable unnecessary XFCE4 autostart services
	AUTOSTART_DIR="/home/atu/.config/autostart"
	mkdir -p "$AUTOSTART_DIR"
	for svc in xfce4-power-manager xfce4-screensaver xfce4-notifyd tumblerd; do
		cp "/etc/xdg/autostart/${svc}.desktop" "$AUTOSTART_DIR/" 2>/dev/null
		echo "Hidden=true" >> "$AUTOSTART_DIR/${svc}.desktop" 2>/dev/null
	done
	chown -R atu:atu "$AUTOSTART_DIR"
}

function install_chromium
{
	echo
	say @B"Installing Chromium browser (portable build)..." yellow

	# Runtime libraries required by Chromium
	apt-get install -y libnss3 libnspr4 libgbm1 libasound2 libdrm2 \
		libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libxfixes3 \
		libxrender1 libcups2 libpango-1.0-0 libatk1.0-0 libatk-bridge2.0-0 \
		libgtk-3-0 libxss1 2>/dev/null || true

	CHROMIUM_DIR=/opt/chromium-latest
	mkdir -p $CHROMIUM_DIR
	cd $CHROMIUM_DIR

	LASTCHANGE_URL="https://commondatastorage.googleapis.com/chromium-browser-snapshots/Linux_x64/LAST_CHANGE"
	REVISION=$(curl -sS "$LASTCHANGE_URL")
		if [ -z "$REVISION" ]; then
			REVISION=$(wget -qO- "$LASTCHANGE_URL")
		fi

	if [ -z "$REVISION" ]; then
		say "Failed to fetch latest Chromium revision." red
		return
	fi

	echo "Latest Chromium revision: $REVISION"

	if [ ! -d "$REVISION/chrome-linux" ]; then
		ZIP_URL="https://commondatastorage.googleapis.com/chromium-browser-snapshots/Linux_x64/$REVISION/chrome-linux.zip"
		mkdir -p $REVISION
		cd $REVISION
		curl -sS -L "$ZIP_URL" -o chrome-linux.zip
		unzip -o chrome-linux.zip
		rm -f chrome-linux.zip
		cd ..
	fi

	rm -f latest
	ln -sf $REVISION/chrome-linux ./latest

	if [ ! -f ./latest/chrome ]; then
		say "Chromium binary not found after extraction." red
		return
	fi

	mkdir -p /home/atu/Desktop /home/atu/.config/chromium-user-data
	cat > /home/atu/Desktop/StartChromium.sh <<'EOF'
#!/bin/bash
CHROME_CRASHPAD_ENABLED=0 /opt/chromium-latest/latest/chrome --no-sandbox --disable-gpu --disable-dev-shm-usage --no-first-run --disable-crashpad-for-testing --js-flags="--max-old-space-size=64" --user-data-dir=/home/atu/.config/chromium-user-data &
echo 1000 > /proc/$!/oom_score_adj
EOF
	chown atu:atu /home/atu/Desktop/StartChromium.sh /home/atu/.config/chromium-user-data
	chmod +x /home/atu/Desktop/StartChromium.sh

	say @B"Chromium (portable build, revision $REVISION) installed." green
}

function optimize_system
{
	echo
	say @B"Applying system optimizations for low-resource operation..." yellow

	# --- Log limits ---
	mkdir -p /etc/systemd/journald.conf.d
	cat > /etc/systemd/journald.conf.d/99-limits.conf <<END
[Journal]
SystemMaxUse=50M
SystemMaxFileSize=10M
MaxRetentionSec=7day
END
	systemctl restart systemd-journald

	if [ -f /etc/systemd/system/tomcat9.service ] ; then
		if ! grep -q "CATALINA_OUT=/dev/null" /etc/systemd/system/tomcat9.service ; then
			sed -i '/Environment=CATALINA_BASE=/a Environment=CATALINA_OUT=/dev/null' /etc/systemd/system/tomcat9.service
		fi
		systemctl daemon-reload
		systemctl restart tomcat9
	fi

	rm -f /var/log/nginx/guac_access.log* 2>/dev/null || true
	systemctl reload nginx 2>/dev/null || true

	# --- Remove snapd (Ubuntu only) ---
	if [ "$OS" = "UBUNTU24" ] ; then
		apt purge snapd -y 2>/dev/null || true
		rm -rf /var/cache/snapd /snap 2>/dev/null || true
	fi

	# --- Disable unattended-upgrades ---
	apt purge unattended-upgrades -y 2>/dev/null || true
	systemctl disable unattended-upgrades 2>/dev/null || true

	# --- Disable useless systemd timers ---
	for timer in apt-daily.timer apt-daily-upgrade.timer man-db.timer motd-news.timer plocate-updatedb.timer mlocate.timer mlocate-updatedb.timer; do
		systemctl disable "$timer" 2>/dev/null || true
		systemctl stop "$timer" 2>/dev/null || true
	done

	# --- Reduce swappiness ---
	if ! grep -q "vm.swappiness" /etc/sysctl.d/99-lowram.conf 2>/dev/null ; then
		echo "vm.swappiness=10" > /etc/sysctl.d/99-lowram.conf
		sysctl -p /etc/sysctl.d/99-lowram.conf
	fi

	# --- Firewall: block all ports except 22, 80, 443 ---
	apt-get install ufw -y 2>/dev/null || true
	ufw --force disable
	ufw default deny incoming
	ufw default allow outgoing
	ufw allow 22/tcp
	ufw allow 80/tcp
	ufw allow 443/tcp
	ufw --force enable

	say @B"System optimized: logs capped, snapd removed, timers disabled, swappiness=10, firewall enabled (22,80,443 only)." green
}

function main
{
	display_license
	if [ "x$OS_CHECK_ENABLED" != "xOFF" ] ; then
		check_OS
	fi
	echo "This script is going to install a desktop environment with browser access."
	echo 
	say @B"This environment requires at least 1 GB of RAM." yellow
	echo 
	confirm_installation=Y
	say @B"Fixed profile enabled. Proceeding automatically..." green
	if [ "x$confirm_installation" = "xY" ] || [ "x$confirm_installation" = "xy" ] ; then
		determine_system_variables
		get_user_options
		install_guacamole_ubuntu_debian
		install_guacamole_web
		configure_guacamole_ubuntu_debian
		enforce_guacd_ipv4
		install_rdp
		setup_atu_user
		install_chromium
		install_reverse_proxy
		echo 
		say @B"Note that after entering Guacamole using the above Guacamole credentials, you will be asked to input your Linux server username and password in the XRDP login panel, which is NOT the guacamole username and password above.  Please use the default Xorg as session type.  After logging in, double-click StartChromium.sh on the desktop to launch the browser." yellow
		if [ -x /opt/chromium-latest/latest/chrome ]; then
			chromium_version=$(/opt/chromium-latest/latest/chrome --version 2>/dev/null)
			say @B"Installed browser version: ${chromium_version}" green
		else
			say "Installed browser version: Chromium not found." red
		fi
	echo
		say @B"Cleaning up build dependencies and package cache..." yellow
		apt-get autoremove --purge -y
		apt-get clean
		optimize_system
	fi
	echo 
	echo "Thank you for using this script written by https://qing.su!"
	echo "Have a nice day!"
}

###############################################################
#                                                             #
#               The main function starts here.                #
#                                                             #
###############################################################

main
exit 0
