#!/usr/bin/env bash
set -euo pipefail

service_dir=/home/ubuntu/moments-publisher
state_dir=/home/ubuntu/.local/share/moments-publisher
config_dir=/home/ubuntu/.config/moments-publisher
current_caddy=/etc/caddy/Caddyfile
backup_caddy=/etc/caddy/Caddyfile.moments-backup
expected_caddy=caca76da6067b1c10bb447777003d026fd525b5de18a6e39d08cdf53d3b3e28c

test "$(id -un)" = ubuntu
test "$(sha256sum "$current_caddy" | cut -d' ' -f1)" = "$expected_caddy"
test ! -e "$backup_caddy"
if test -e /etc/systemd/system/moments-publisher.service; then
    cmp -s /etc/systemd/system/moments-publisher.service "$service_dir/moments-publisher.service"
fi
test -f "$service_dir/server.py"
test -f "$service_dir/Caddyfile"
test -f "$service_dir/moments-publisher.service"
python3 -m py_compile "$service_dir/server.py"
sudo -n caddy validate --config "$service_dir/Caddyfile"

install -d -m 700 "$state_dir" "$config_dir"
if test ! -e "$config_dir/env"; then
    umask 077
    python3 - "$state_dir" > "$config_dir/env" <<'PY'
import secrets
import sys
print('MOMENTS_APP_CONFIG=' + sys.argv[1] + '/app.json')
print('MOMENTS_SETUP_KEY=' + secrets.token_urlsafe(48))
PY
fi
chmod 600 "$config_dir/env"
if test ! -e /etc/systemd/system/moments-publisher.service; then
    sudo -n install -m 644 "$service_dir/moments-publisher.service" /etc/systemd/system/moments-publisher.service
fi
sudo -n systemctl daemon-reload
sudo -n systemctl enable --now moments-publisher.service
systemctl is-active --quiet moments-publisher.service
healthy=false
for attempt in {1..10}; do
    if curl --noproxy '*' -fsS --max-time 2 http://127.0.0.1:13301/moments-api/health > /dev/null; then
        healthy=true
        break
    fi
    sleep 1
done
test "$healthy" = true

sudo -n install -m 600 "$current_caddy" "$backup_caddy"
sudo -n install -m 644 "$service_dir/Caddyfile" "$current_caddy"
if ! sudo -n caddy validate --config "$current_caddy" || ! sudo -n systemctl reload caddy.service; then
    sudo -n install -m 644 "$backup_caddy" "$current_caddy"
    sudo -n systemctl reload caddy.service
    exit 1
fi
echo 'Moments service installed. GitHub App registration is pending.'
