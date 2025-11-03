"""
digitforce api
"""

import json

import requests


class DigitForceApi:
    def __init__(self, api_key):
        self.api_key = api_key

    def get_header_url(self, service_name, type="prod"):
        if type == "localhost":
            api_base = "http://localhost:8910/api/platform_api/"
            headers = {
                "Cookie": f"access-token={self.api_key}",
            }
        elif type == "test":
            api_base = "https://test.ada.im/api/platform_api/"
            headers = {
                "Authorization": self.api_key,
            }
        else:  # default to prod
            api_base = "https://ada.im/api/platform_api/"
            headers = {
                "Authorization": self.api_key,
            }
        url = api_base + service_name
        return headers, url

    def dify_api_post(self, data: dict, service_name: str):
        headers, url = self.get_header_url(service_name, type="prod")
        headers["X-Platform-Source"] = "dify"
        # 增加版本号
        data["version"] = "2.0.0"
        response = None
        try:
            response = requests.post(url, headers=headers, data=json.dumps(data))
            json_data = json.loads(response.text)
        except Exception as e:
            if response is not None:
                response_text = response.text
                if response_text == "":
                    raise Exception(
                        "Please check if your API key is valid or if the maximum number of calls has been reached"
                    ) from e
                else:
                    raise Exception(f"request error:{e}\nresponse:{response_text}") from e
            else:
                raise Exception(f"request error:{e}") from e
        if json_data.get("status") != 200:
            raise Exception(f"response error: {json_data}")
        return json_data.get("data")
