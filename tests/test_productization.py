import re
import struct
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ProductizationContracts(unittest.TestCase):
    def test_primary_controls_match_the_runtime_dom_contract(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "script.js").read_text(encoding="utf-8")
        self.assertIn('id="btn-show-layer-panel"', html)
        self.assertIn("getElementById('btn-show-layer-panel')", script)
        self.assertNotIn("getElementById('toggleLayerPanelBtn')", script)

    def test_critical_functions_have_one_implementation(self):
        script = (ROOT / "script.js").read_text(encoding="utf-8")
        for name in ("deleteLayer", "toggleLayerPanel", "clearLayerSearch", "toggleToolsMenu", "closeToolsMenu"):
            count = len(re.findall(rf"function\s+{name}\s*\(", script))
            self.assertEqual(count, 1, f"{name} should have one implementation")

    def test_project_home_assets_and_license_exist(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("docs/images/geomap-overview.png", readme)
        self.assertTrue((ROOT / "LICENSE").exists())
        screenshot = (ROOT / "docs/images/geomap-overview.png").read_bytes()
        self.assertEqual(screenshot[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual(struct.unpack(">II", screenshot[16:24]), (1440, 900))

    def test_application_dependencies_are_local(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertNotRegex(html, r'<(?:script|link)[^>]+(?:src|href)="https?://')
        self.assertIn('/vendor/leaflet/leaflet.js', html)

    def test_windows_launcher_uses_vite_runtime(self):
        launcher = (ROOT / "启动地图编辑器.bat").read_text(encoding="utf-8")
        launcher.encode("ascii")
        self.assertIn("npm run prepare:vendor", launcher)
        self.assertIn("npm run dev", launcher)
        self.assertIn("--host 127.0.0.1 --open", launcher)
        self.assertIn("fontawesome-free\\css\\all.min.css", launcher)
        self.assertIn('if "%NEEDS_INSTALL%"=="1"', launcher)
        self.assertNotIn("python server.py", launcher)


if __name__ == "__main__":
    unittest.main()
