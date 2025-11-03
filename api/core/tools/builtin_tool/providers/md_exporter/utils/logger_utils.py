import logging


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance for built-in tools.

    Uses standard Python logging without plugin-specific handlers.
    """
    logger = logging.getLogger(name)
    if not logger.handlers:
        # Only add handler if logger doesn't have one already
        handler = logging.StreamHandler()
        formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger
