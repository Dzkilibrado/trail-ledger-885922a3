"""Creates ONLY a standalone synthetic cluster; never uses managed PG environment."""
import os
import pwd
import subprocess
from pathlib import Path

root = Path('/tmp/trailbook-pg')
root.mkdir(exist_ok=True)
account = pwd.getpwnam('lovable')
os.chown(root, account.pw_uid, account.pw_gid)

def demote():
    os.setgid(account.pw_gid)
    os.setuid(account.pw_uid)

def run(args):
    subprocess.run(args, preexec_fn=demote, check=True)

if not (root / 'data/PG_VERSION').exists():
    run(['initdb', '-D', str(root / 'data'), '-A', 'trust', '--no-locale', '-E', 'UTF8'])
if not (root / 'data/postmaster.pid').exists():
    run(['pg_ctl', '-D', str(root / 'data'), '-l', str(root / 'server.log'),
         '-o', '-p 55432 -h 127.0.0.1 -k /tmp/trailbook-pg', 'start'])
print('Synthetic PostgreSQL ready on 127.0.0.1:55432; shared Cloud untouched.')