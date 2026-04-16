"""
Flask extension singletons.
Imported by both app.py and any module that needs db/bcrypt/etc.
This breaks the circular import between app.py and database/models.py.
"""
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
bcrypt = Bcrypt()
jwt = JWTManager()
mail = Mail()
socketio = SocketIO()
limiter = Limiter(key_func=get_remote_address)
