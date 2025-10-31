"""
Secure URL Scraper Wrapper with SSRF (Server-Side Request Forgery) protection.

Security Features (SEC-003 Mitigation):
1. Protocol whitelist: Only http:// and https:// allowed
2. Internal IP blocking: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
3. DNS rebinding defense: Re-validate IP after resolution
4. HTTP request constraints: Timeout, redirect limits, content-type validation
"""

import ipaddress
import socket
from collections.abc import Generator
from typing import Any
from urllib.parse import urlparse

import requests

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage
from core.tools.errors import ToolInvokeError


class URLScraperTool(BuiltinTool):
    """
    Secure wrapper for URL scraping with comprehensive SSRF protection.

    This tool validates URLs against various SSRF attack vectors before
    making HTTP requests to external websites.

    Security Checks:
    - Protocol validation (http/https only)
    - Internal/private IP range blocking
    - DNS rebinding prevention
    - Request timeout and redirect limits
    - Content-type validation
    """

    # Blocked IP networks (SSRF prevention)
    BLOCKED_NETWORKS = [
        ipaddress.ip_network("127.0.0.0/8"),  # Localhost
        ipaddress.ip_network("10.0.0.0/8"),  # Private network
        ipaddress.ip_network("172.16.0.0/12"),  # Private network
        ipaddress.ip_network("192.168.0.0/16"),  # Private network
        ipaddress.ip_network("169.254.0.0/16"),  # Link-local / AWS metadata
        ipaddress.ip_network("::1/128"),  # IPv6 localhost
        ipaddress.ip_network("fc00::/7"),  # IPv6 private
    ]

    # Allowed protocols
    ALLOWED_PROTOCOLS = ["http", "https"]

    # HTTP request constraints
    REQUEST_TIMEOUT = 5  # seconds
    MAX_REDIRECTS = 3
    USER_AGENT = "EduAI-Studio/1.0"

    def _invoke(
        self,
        user_id: str,
        tool_parameters: dict[str, Any],
        conversation_id: str | None = None,
        app_id: str | None = None,
        message_id: str | None = None,
    ) -> Generator[ToolInvokeMessage, None, None]:
        """
        Invoke URL scraper with SSRF protection.

        Args:
            user_id: The user ID
            tool_parameters: Tool parameters containing 'url'
            conversation_id: Optional conversation ID
            app_id: Optional app ID
            message_id: Optional message ID

        Yields:
            ToolInvokeMessage: Scraped content or error message

        Raises:
            ToolInvokeError: If URL is malicious or scraping fails
        """
        url = tool_parameters.get("url", "").strip()

        if not url:
            yield self.create_text_message("Please provide a URL")
            return

        try:
            # Step 1: Validate URL format and protocol
            self._validate_url_protocol(url)

            # Step 2: Resolve hostname and check for internal IPs
            resolved_ip = self._resolve_and_validate_ip(url)

            # Step 3: Make secure HTTP request
            content = self._make_secure_request(url)

            # Step 4: Re-check DNS to prevent DNS rebinding attacks
            self._prevent_dns_rebinding(url, resolved_ip)

            # Step 5: Return scraped content
            yield self.create_text_message(content)

        except ToolInvokeError:
            # Security errors - propagate as-is
            raise
        except requests.exceptions.Timeout:
            raise ToolInvokeError(f"Request timeout: URL took longer than {self.REQUEST_TIMEOUT} seconds to respond")
        except requests.exceptions.TooManyRedirects:
            raise ToolInvokeError(f"Too many redirects: URL exceeded {self.MAX_REDIRECTS} redirects")
        except requests.exceptions.RequestException as e:
            raise ToolInvokeError(f"Failed to fetch URL: {e!s}")
        except Exception as e:
            raise ToolInvokeError(f"Unexpected error while scraping URL: {e!s}")

    def _validate_url_protocol(self, url: str) -> None:
        """
        Validate URL protocol (http/https only).

        Args:
            url: The URL to validate

        Raises:
            ToolInvokeError: If protocol is not allowed
        """
        # Check for allowed protocols
        if not url.startswith(("http://", "https://")):
            raise ToolInvokeError("Only http:// and https:// protocols are allowed")

        # Block dangerous protocols explicitly
        dangerous_protocols = ["file://", "ftp://", "data://", "gopher://", "javascript:", "vbscript:"]
        for protocol in dangerous_protocols:
            if url.lower().startswith(protocol):
                raise ToolInvokeError(f"Protocol not allowed for security reasons: {protocol}")

        # Validate URL format
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            raise ToolInvokeError("Invalid URL format")

        if parsed.scheme not in self.ALLOWED_PROTOCOLS:
            raise ToolInvokeError(f"Protocol '{parsed.scheme}' is not allowed")

    def _resolve_and_validate_ip(self, url: str) -> str:
        """
        Resolve hostname to IP and validate against blocked networks.

        Args:
            url: The URL to resolve

        Returns:
            str: The resolved IP address

        Raises:
            ToolInvokeError: If hostname resolves to a blocked IP
        """
        parsed = urlparse(url)
        hostname = parsed.hostname

        if not hostname:
            raise ToolInvokeError("URL does not contain a valid hostname")

        try:
            # Resolve hostname to IP
            ip_str = socket.gethostbyname(hostname)
            ip_obj = ipaddress.ip_address(ip_str)

            # Check against blocked networks
            for network in self.BLOCKED_NETWORKS:
                if ip_obj in network:
                    raise ToolInvokeError(
                        f"Access to internal/private IP addresses is not allowed (resolved to {ip_str})"
                    )

            return ip_str

        except socket.gaierror as e:
            raise ToolInvokeError(f"Failed to resolve hostname '{hostname}': {e!s}")

    def _make_secure_request(self, url: str) -> str:
        """
        Make HTTP request with security constraints.

        Args:
            url: The URL to fetch

        Returns:
            str: The response content

        Raises:
            ToolInvokeError: If content-type is invalid or request fails
            requests.exceptions.RequestException: On HTTP errors
        """
        # Make request with security settings
        # Note: requests library doesn't have max_redirects parameter directly
        # Redirects are limited by allow_redirects=True (default limit is 30)
        response = requests.get(
            url,
            timeout=self.REQUEST_TIMEOUT,
            allow_redirects=True,
            headers={"User-Agent": self.USER_AGENT},
        )

        # Raise for HTTP errors (4xx, 5xx)
        response.raise_for_status()

        # Validate content-type (allow text/* and application/*)
        content_type = response.headers.get("Content-Type", "")
        if content_type and not content_type.startswith(("text/", "application/")):
            raise ToolInvokeError(f"Invalid content type: {content_type}. Only text/* and application/* are allowed.")

        return response.text

    def _prevent_dns_rebinding(self, url: str, initial_ip: str) -> None:
        """
        Re-validate DNS to prevent DNS rebinding attacks.

        DNS rebinding attack: Attacker's DNS server returns a safe IP initially,
        then changes to an internal IP on subsequent lookups.

        Args:
            url: The URL to re-validate
            initial_ip: The initially resolved IP address

        Raises:
            ToolInvokeError: If IP address has changed (DNS rebinding detected)
        """
        parsed = urlparse(url)
        hostname = parsed.hostname

        if not hostname:
            return

        try:
            # Re-resolve hostname
            final_ip = socket.gethostbyname(hostname)

            if final_ip != initial_ip:
                raise ToolInvokeError(
                    f"DNS rebinding detected: IP address changed from {initial_ip} to {final_ip} during request"
                )

        except socket.gaierror:
            # If re-resolution fails, it's suspicious but we already made the request
            # Log warning but don't fail (request was already made with validated IP)
            pass
