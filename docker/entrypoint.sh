#!/bin/sh
set -e

echo "Waiting for database..."
python manage.py makemigrations accounts connectors submissions --noinput
python manage.py migrate --noinput
echo "Migrations complete."

python manage.py collectstatic --noinput
echo "Static files collected."

exec "$@"
