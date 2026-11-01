import asyncio
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lead_harvester.denue import DenueHarvester
from lead_harvester.scoring import rule_score
from lead_harvester.models import RawLead


def test_denue_fixture():
    async def run():
        h = DenueHarvester(fixture_path="lead_harvester/fixtures/denue_sample.json")
        assert await h.health_check()
        leads = [l async for l in h.harvest()]
        assert len(leads) == 2
        assert leads[0].razon_social == "Despacho Contable ABC"
        assert leads[0].scian_code == "541210"
    asyncio.run(run())


def test_rule_score():
    lead = RawLead(razon_social="X", actividad="SAT cartera vencida CFDI", source="denue")
    s = rule_score(lead)
    assert s > 50
