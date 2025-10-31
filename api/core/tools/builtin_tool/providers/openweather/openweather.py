from typing import Any

import requests

from core.tools.builtin_tool.provider import BuiltinToolProviderController
from core.tools.errors import ToolProviderCredentialValidationError


def query_weather(
    city: str = "Beijing", units: str = "metric", language: str = "zh_cn", api_key: str | None = None
) -> requests.Response:
    """
    Query weather from OpenWeather API.

    Args:
        city: City name
        units: Units (metric/imperial)
        language: Language code
        api_key: OpenWeather API key

    Returns:
        Response object
    """
    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"q": city, "appid": api_key, "units": units, "lang": language}
    return requests.get(url, params=params, timeout=30)


class OpenweatherProvider(BuiltinToolProviderController):
    def _validate_credentials(self, user_id: str, credentials: dict[str, Any]) -> None:
        """
        Validate credentials for OpenWeather provider.

        Args:
            user_id: User ID
            credentials: Provider credentials containing 'api_key'

        Raises:
            ToolProviderCredentialValidationError: If credentials are invalid
        """
        try:
            if "api_key" not in credentials or not credentials.get("api_key"):
                raise ToolProviderCredentialValidationError("OpenWeather API key is required.")

            apikey = credentials.get("api_key")
            try:
                response = query_weather(api_key=apikey)
                if response.status_code != 200:
                    raise ToolProviderCredentialValidationError(response.json().get("message", "Unknown error"))
            except requests.exceptions.RequestException as e:
                raise ToolProviderCredentialValidationError(f"OpenWeather API Key is invalid. {e}") from e
        except ToolProviderCredentialValidationError:
            raise
        except Exception as e:
            raise ToolProviderCredentialValidationError(str(e)) from e
