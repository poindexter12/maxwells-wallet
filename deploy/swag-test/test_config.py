#!/usr/bin/env python3
"""
Tests for SWAG demo deployment configuration.

Run with: python -m pytest deploy/swag-test/test_config.py -v
"""

import subprocess
from pathlib import Path

import pytest
import yaml

DEPLOY_DIR = Path(__file__).parent


class TestDockerCompose:
    """Test docker-compose configuration files."""

    def test_main_compose_is_valid_yaml(self):
        """docker-compose.yaml should be valid YAML."""
        compose_file = DEPLOY_DIR / "docker-compose.yaml"
        assert compose_file.exists(), "docker-compose.yaml not found"

        with open(compose_file) as f:
            config = yaml.safe_load(f)

        assert config is not None
        assert "services" in config

    def test_main_compose_has_required_services(self):
        """docker-compose.yaml should define swag, app, and cloudflared services."""
        compose_file = DEPLOY_DIR / "docker-compose.yaml"

        with open(compose_file) as f:
            config = yaml.safe_load(f)

        services = config["services"]
        assert "swag" in services, "Missing 'swag' service"
        assert "app" in services, "Missing 'app' service"
        assert "cloudflared" in services, "Missing 'cloudflared' service"

    def test_app_service_has_demo_mode_enabled(self):
        """App service should have DEMO_MODE=true."""
        compose_file = DEPLOY_DIR / "docker-compose.yaml"

        with open(compose_file) as f:
            config = yaml.safe_load(f)

        app_env = config["services"]["app"]["environment"]
        assert "DEMO_MODE=true" in app_env, "DEMO_MODE should be true"

    def test_app_service_has_hourly_reset(self):
        """App service should reset every hour."""
        compose_file = DEPLOY_DIR / "docker-compose.yaml"

        with open(compose_file) as f:
            config = yaml.safe_load(f)

        app_env = config["services"]["app"]["environment"]
        assert "DEMO_RESET_INTERVAL_HOURS=1" in app_env, "Should reset hourly"

    def test_cloudflared_uses_profile(self):
        """Cloudflared should only start with --profile cloudflare."""
        compose_file = DEPLOY_DIR / "docker-compose.yaml"

        with open(compose_file) as f:
            config = yaml.safe_load(f)

        cloudflared = config["services"]["cloudflared"]
        assert "profiles" in cloudflared, "cloudflared should use profiles"
        assert "cloudflare" in cloudflared["profiles"]

    def test_swag_exposes_port_8888(self):
        """SWAG should expose port 8888 for HTTP."""
        compose_file = DEPLOY_DIR / "docker-compose.yaml"

        with open(compose_file) as f:
            config = yaml.safe_load(f)

        swag_ports = config["services"]["swag"]["ports"]
        port_mappings = [str(p) for p in swag_ports]
        assert any("8888:80" in p for p in port_mappings), "Should expose 8888:80"

    def test_dind_compose_is_valid_yaml(self):
        """docker-compose.dind.yaml should be valid YAML."""
        compose_file = DEPLOY_DIR / "docker-compose.dind.yaml"
        assert compose_file.exists(), "docker-compose.dind.yaml not found"

        with open(compose_file) as f:
            config = yaml.safe_load(f)

        assert config is not None
        assert "services" in config
        assert "dind" in config["services"]


class TestNginxConfig:
    """Test nginx configuration."""

    def test_nginx_config_exists(self):
        """nginx.conf should exist."""
        nginx_conf = DEPLOY_DIR / "swag" / "nginx.conf"
        assert nginx_conf.exists(), "swag/nginx.conf not found"

    def test_nginx_config_has_api_location(self):
        """nginx.conf should proxy /api/ to backend."""
        nginx_conf = DEPLOY_DIR / "swag" / "nginx.conf"

        content = nginx_conf.read_text()
        assert "location /api/" in content, "Should have /api/ location block"
        assert "proxy_pass http://app:3001" in content, "Should proxy to app:3001"

    def test_nginx_config_has_frontend_location(self):
        """nginx.conf should proxy / to frontend."""
        nginx_conf = DEPLOY_DIR / "swag" / "nginx.conf"

        content = nginx_conf.read_text()
        assert "location /" in content, "Should have / location block"
        assert "proxy_pass http://app:3000" in content, "Should proxy to app:3000"

    def test_nginx_config_has_security_headers(self):
        """nginx.conf should include security headers."""
        nginx_conf = DEPLOY_DIR / "swag" / "nginx.conf"

        content = nginx_conf.read_text()
        assert "X-Content-Type-Options" in content
        assert "X-Frame-Options" in content


class TestMakefile:
    """Test Makefile targets."""

    def test_makefile_exists(self):
        """Makefile should exist."""
        makefile = DEPLOY_DIR / "Makefile"
        assert makefile.exists(), "Makefile not found"

    def test_makefile_has_required_targets(self):
        """Makefile should have up, down, cloudflare, logs, clean targets."""
        makefile = DEPLOY_DIR / "Makefile"

        content = makefile.read_text()
        required_targets = ["up:", "down:", "cloudflare:", "logs:", "clean:"]

        for target in required_targets:
            assert target in content, f"Missing target: {target}"

    def test_makefile_has_help_as_default(self):
        """Makefile should have help as default target."""
        makefile = DEPLOY_DIR / "Makefile"

        content = makefile.read_text()
        assert ".DEFAULT_GOAL := help" in content


class TestSupportingFiles:
    """Test supporting files exist."""

    def test_env_example_exists(self):
        """.env.example should exist with CLOUDFLARE_TUNNEL_TOKEN."""
        env_example = DEPLOY_DIR / ".env.example"
        assert env_example.exists(), ".env.example not found"

        content = env_example.read_text()
        assert "CLOUDFLARE_TUNNEL_TOKEN" in content

    def test_readme_exists(self):
        """README.md should exist."""
        readme = DEPLOY_DIR / "README.md"
        assert readme.exists(), "README.md not found"

    def test_gitignore_excludes_env(self):
        """Root .gitignore should exclude deploy/swag-test/.env."""
        gitignore = DEPLOY_DIR.parent.parent / ".gitignore"

        content = gitignore.read_text()
        assert "deploy/swag-test/.env" in content, ".env should be gitignored"
