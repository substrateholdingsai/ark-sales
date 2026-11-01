import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import lead_harvester.profile as profile


def test_detect_software():
    p = profile.HTTPProfiler()
    html = "<html>contpaq wordpress shopify</html>"
    assert "CONTPAQi" in p._detect(html, profile.PATS_SOFTWARE)
    assert "WordPress" in p._detect(html, profile.PATS_SOFTWARE)


def test_detect_dolor():
    p = profile.HTTPProfiler()
    html = "<html>sat cartera vencida cfdi</html>"
    d = p._detect(html, profile.PATS_DOLOR)
    assert "DOLOR_SAT" in d
    assert "DOLOR_MOROSIDAD" in d
    assert "DOLOR_CFDI" in d
