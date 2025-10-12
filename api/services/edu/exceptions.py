"""Education domain-specific exceptions."""


class EducationError(Exception):
    """Base exception for education domain."""

    pass


class ResourceAlreadyTaggedError(EducationError):
    """Raised when attempting to tag a resource that is already tagged."""

    pass


class ResourceTagNotFoundError(EducationError):
    """Raised when a resource tag is not found."""

    pass
