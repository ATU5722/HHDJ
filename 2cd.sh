#!/bin/bash
###########################################################################################
#    One-click Desktop & Browser Access Setup Script v0.4.0                               #
#    Written by shc (https://qing.su)                                                     #
#    Github link: https://github.com/Har-Kuun/OneClickDesktop                             #
#    Contact me: https://t.me/hsun94   E-mail: hi@qing.su                                 #
#                                                                                         #
#    This script is distributed in the hope that it will be                               #
#    useful, but ABSOLUTELY WITHOUT ANY WARRANTY.                                         #
#                                                                                         #
#    Thank you for using this script.                                                     #
###########################################################################################


#You can change the Guacamole source file download link here.
#Check https://guacamole.apache.org/releases/ for the latest stable version.

GUACAMOLE_DOWNLOAD_LINK="https://dlcdn.apache.org/guacamole/1.5.5/source/guacamole-server-1.5.5.tar.gz"
GUACAMOLE_VERSION="1.5.5"

#By default, this script only works on Ubuntu 24 and Debian 12.
#You can disable the OS check switch below to try to install it in other OS versions.
#Please do note that if you choose to use this script on unsupported OS, you might mess up your system.

OS_CHECK_ENABLED=ON

# ===== One-click deployment default configuration =====
# Override any of these via environment variable, e.g.: GUAC_USER=myuser bash 2cd.sh
GUAC_USER="${GUAC_USER:-atu}"
GUAC_PASS="${GUAC_PASS:-atu}"
RDP_WIDTH="${RDP_WIDTH:-1280}"
RDP_HEIGHT="${RDP_HEIGHT:-800}"
INSTALL_NGINX="${INSTALL_NGINX:-Y}"
LETSENCRYPT="${LETSENCRYPT:-Y}"
LE_EMAIL="${LE_EMAIL:-zshyydyx@163.com}"




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
	CurrentDir=$(pwd)
}

function get_user_options
{
	echo
	say @B"Using one-click deployment with default configuration..." yellow

	guacamole_username="$GUAC_USER"
	guacamole_password_prehash="$GUAC_PASS"
	read guacamole_password_md5 <<< $(echo -n $guacamole_password_prehash | md5sum | awk '{print $1}')
	say @B"Guacamole user: $guacamole_username" green

	rdp_screen_width="$RDP_WIDTH"
	rdp_screen_height="$RDP_HEIGHT"
	say @B"RDP resolution: ${rdp_screen_width}x${rdp_screen_height}" green

	echo
	install_nginx="$INSTALL_NGINX"
	if [ "x$install_nginx" != "xn" ] && [ "x$install_nginx" != "xN" ] ; then
		say @B"Nginx reverse proxy: enabled" green
		echo
		say @B"Please input your domain name (e.g., desktop.qing.su):" yellow
		read guacamole_hostname
		echo
		confirm_letsencrypt="$LETSENCRYPT"
		if [ "x$confirm_letsencrypt" = "xY" ] || [ "x$confirm_letsencrypt" = "xy" ] ; then
			le_email="$LE_EMAIL"
			say @B"Let's Encrypt SSL: enabled (${le_email})" green
		fi
	else
		say @B"Nginx will NOT be installed on this server." yellow
	fi
	echo
	say @B"Desktop environment installation will start now.  Please wait." green
	sleep 3
}

function install_guacamole_ubuntu_debian
{
	echo
	say @B"Setting up dependencies..." yellow
	echo
	apt-get update && apt-get upgrade -y
	if [ "$OS" = "UBUNTU24" ] ; then
		apt-get install libjpeg-turbo8-dev language-pack-ja language-pack-zh* language-pack-ko -y
		apt-get install wget curl gcc sudo zip unzip tar perl expect build-essential libcairo2-dev libpng-dev libtool-bin libossp-uuid-dev libvncserver-dev freerdp2-dev libssh2-1-dev libtelnet-dev libwebsockets-dev libpulse-dev libvorbis-dev libwebp-dev libssl-dev libpango1.0-dev libswscale-dev libavcodec-dev libavutil-dev libavformat-dev japan* chinese* korean* fonts-arphic-ukai fonts-arphic-uming fonts-ipafont-mincho fonts-ipafont-gothic fonts-unfonts-core -y
		install_tomcat9_ubuntu
	else
		apt-get install libjpeg62-turbo-dev -y
		apt-get install wget curl gcc sudo zip unzip tar perl expect build-essential libcairo2-dev libpng-dev libtool-bin libossp-uuid-dev libvncserver-dev freerdp2-dev libssh2-1-dev libtelnet-dev libwebsockets-dev libpulse-dev libvorbis-dev libwebp-dev libssl-dev libpango1.0-dev libswscale-dev libavcodec-dev libavutil-dev libavformat-dev japan* chinese* korean* fonts-arphic-ukai fonts-arphic-uming fonts-ipafont-mincho fonts-ipafont-gothic fonts-unfonts-core -y
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
	echo JAVA_HOME="/usr/lib/jvm/java-21-openjdk-amd64" >> /etc/environment
	source /etc/environment
	curl -s https://archive.apache.org/dist/tomcat/tomcat-9/v9.0.38/bin/apache-tomcat-9.0.38.tar.gz | tar -xz
	mv apache-tomcat-9.0.38 /etc/tomcat9
	echo "export CATALINA_HOME="/etc/tomcat9"" >> ~/.bashrc
	source ~/.bashrc
	useradd -r tomcat
	chown -R tomcat:tomcat /etc/tomcat9
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
Environment=CATALINA_OUT=/dev/null
Environment=CATALINA_BASE=/etc/tomcat9

ExecStart=/etc/tomcat9/bin/catalina.sh start
ExecStop=/etc/tomcat9/bin/catalina.sh stop

RestartSec=10
OOMScoreAdjust=-500
Restart=on-failure
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
	echo JAVA_HOME="/usr/lib/jvm/java-1.17.0-openjdk-amd64" >> /etc/environment
	source /etc/environment
	curl -s https://archive.apache.org/dist/tomcat/tomcat-9/v9.0.38/bin/apache-tomcat-9.0.38.tar.gz | tar -xz
	mv apache-tomcat-9.0.38 /etc/tomcat9
	echo "export CATALINA_HOME="/etc/tomcat9"" >> ~/.bashrc
	source ~/.bashrc
	useradd -r tomcat
	chown -R tomcat:tomcat /etc/tomcat9
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
Environment=CATALINA_OUT=/dev/null
Environment=CATALINA_BASE=/etc/tomcat9

ExecStart=/etc/tomcat9/bin/catalina.sh start
ExecStop=/etc/tomcat9/bin/catalina.sh stop

RestartSec=10
OOMScoreAdjust=-500
Restart=on-failure
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
	systemctl restart tomcat* guacd
	say @B"Guacamole successfully configured!" green
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
}

function install_chrome
{
	echo
	say @B"Installing Google Chrome..." yellow

	apt-get install -y wget gnupg ca-certificates
	cat > /etc/apt/sources.list.d/google-chrome.list <<END
deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main
END
	wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /etc/apt/trusted.gpg.d/google-chrome.gpg
	apt-get update
	apt-get install -y google-chrome-stable

	mkdir -p /home/atu/Desktop
	cat > /home/atu/Desktop/StartChrome.sh <<'EOF'
#!/bin/bash
google-chrome-stable --no-sandbox --disable-gpu --disable-dev-shm-usage --no-first-run --disable-crashpad-for-testing --js-flags="--max-old-space-size=64" &
echo 1000 > /proc/$!/oom_score_adj
EOF
	chown atu:atu /home/atu/Desktop/StartChrome.sh 2>/dev/null || true
	chmod +x /home/atu/Desktop/StartChrome.sh

	google-chrome-stable --version
	say @B"Google Chrome successfully installed!" green
}

function install_rdp
{
	echo
	echo "Starting to install desktop and XRDP server..."
	if [ "$OS" = "UBUNTU24" ] ; then
		say @B"Please note that if you are asked to configure LightDM during this step, simply press Enter." yellow
		echo
	fi
	apt-get install xfce4 xfce4-goodies xrdp -y
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

if test -r /etc/profile; then
        . /etc/profile
fi

 xfce4-session

test -x /etc/X11/Xsession && exec /etc/X11/Xsession
exec /bin/sh /etc/X11/Xsession

END
	chmod +x /etc/xrdp/startwm.sh
	systemctl enable xrdp
	systemctl restart xrdp
	sleep 5
	echo "Waiting to start XRDP server..."
	systemctl restart guacd
	ss -lnpt | grep xrdp > /dev/null
	if [ $? = 0 ] ; then
		ss -lnpt | grep guacd > /dev/null
		if [ $? = 0 ] ; then
			say @B"XRDP and desktop successfully configured!" green
		else
			say @B"XRDP and desktop successfully configured!" green
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
	sed -i 's/worker_connections [0-9]*;/worker_connections 256;/' /etc/nginx/nginx.conf
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

function optimize_system
{
	echo
	say @B"Applying system optimizations for low-resource operation..." yellow

	# Limit journald logs
	mkdir -p /etc/systemd/journald.conf.d
	cat > /etc/systemd/journald.conf.d/99-limits.conf <<END
[Journal]
SystemMaxUse=50M
SystemMaxFileSize=10M
MaxRetentionSec=7day
END
	systemctl restart systemd-journald

	# Purge unattended-upgrades
	apt-get purge unattended-upgrades -y 2>/dev/null || true
	systemctl disable unattended-upgrades 2>/dev/null || true

	# Disable unnecessary systemd timers
	for timer in apt-daily.timer apt-daily-upgrade.timer man-db.timer motd-news.timer plocate-updatedb.timer mlocate.timer mlocate-updatedb.timer; do
		systemctl disable "$timer" 2>/dev/null || true
		systemctl stop "$timer" 2>/dev/null || true
	done

	# Reduce swappiness
	if ! grep -q "vm.swappiness" /etc/sysctl.d/99-lowram.conf 2>/dev/null ; then
		echo "vm.swappiness=10" > /etc/sysctl.d/99-lowram.conf
		sysctl -p /etc/sysctl.d/99-lowram.conf
	fi

	# Disable XFCE compositing for atu user
	if [ -d /home/atu ] ; then
		mkdir -p /home/atu/.config/xfce4/xfconf/xfce-perchannel-xml
		cat > /home/atu/.config/xfce4/xfconf/xfce-perchannel-xml/xfwm4.xml <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<channel name="xfwm4" version="1.0">
  <property name="general" type="empty">
    <property name="use_compositing" type="bool" value="false"/>
  </property>
</channel>
EOF
		chown -R atu:atu /home/atu/.config
	fi

	say @B"System optimized: logs capped, timers disabled, swappiness=10, compositing off." green
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
	say @B"One-click mode enabled. Proceeding automatically..." green
	if [ "x$confirm_installation" = "xY" ] || [ "x$confirm_installation" = "xy" ] ; then
		determine_system_variables
		get_user_options
		install_guacamole_ubuntu_debian
		install_guacamole_web
		configure_guacamole_ubuntu_debian
		enforce_guacd_ipv4
		install_rdp
		setup_atu_user
		install_chrome
		if [ "x$install_nginx" != "xn" ] && [ "x$install_nginx" != "xN" ] ; then
			install_reverse_proxy
		else
			say @B"You can now access your desktop at http://$(curl -s icanhazip.com):8080/guacamole!" green
			say @B"Your Guacamole username is $guacamole_username and your password is $guacamole_password_prehash." green
		fi

		if [ "$OS" = "DEBIAN12" ] ; then
			sed -i '0,/return \$retval/{s/return \$retval/\/usr\/local\/sbin\/guacd\n\/usr\/local\/sbin\/guacd\nreturn \$retval/}' /etc/init.d/guacd
			systemctl daemon-reload
			/usr/local/sbin/guacd
			/usr/local/sbin/guacd
		fi

		echo
		say @B"Note that after entering Guacamole using the above Guacamole credentials, you will be asked to input your Linux server username and password in the XRDP login panel, which is NOT the guacamole username and password above.  Please use the default Xorg as session type." yellow
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
