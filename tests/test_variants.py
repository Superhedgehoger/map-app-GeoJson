import importlib.util
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_builder():
    spec = importlib.util.spec_from_file_location("geomap_build_single", ROOT / "build-single.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class VariantBuildTests(unittest.TestCase):
    def test_shared_source_declares_both_variants(self):
        config = (ROOT / "variant-config.js").read_text(encoding="utf-8")
        self.assertIn("eventTracker: variant === 'full'", config)
        self.assertIn("geomap-app-lite", config)
        self.assertIn("'full'", (ROOT / "distribution-config.js").read_text(encoding="utf-8"))

    def test_lite_build_injects_variant_and_all_local_modules(self):
        builder = load_builder()
        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir) / "lite.html"
            builder.build_single_html(output_name=str(output), variant="lite")
            html = output.read_text(encoding="utf-8")

        self.assertIn('window.GEOMAP_VARIANT = "lite";', html)
        self.assertIn("popup-config.js", html)
        self.assertNotIn('src="script.js"', html)
        self.assertNotIn('href="style.css"', html)


if __name__ == "__main__":
    unittest.main()
