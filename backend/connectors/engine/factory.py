"""
Factory that returns the correct connector based on db_type.
"""
from .base import DatabaseConnector


def ConnectorFactory(db_type: str, **kwargs) -> DatabaseConnector:
    """Create a database connector instance by db_type."""
    connectors = {
        'postgresql': 'connectors.engine.pg.PostgreSQLConnector',
        'mysql': 'connectors.engine.mysql.MySQLConnector',
        'mongodb': 'connectors.engine.mongo.MongoDBConnector',
        'clickhouse': 'connectors.engine.ch.ClickHouseConnector',
    }
    path = connectors.get(db_type)
    if not path:
        raise ValueError(f"Unsupported database type: {db_type}")

    module_path, class_name = path.rsplit('.', 1)
    import importlib
    module = importlib.import_module(module_path)
    cls = getattr(module, class_name)
    return cls(**kwargs)
