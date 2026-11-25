[![make.fun](https://make.fun/badge/news-image-20261125.svg)](https://make.fun/bounty/news-image-20261125)
[![rank](https://make.fun/badge/news-image-20261125/kornztt/news-image-20261125/rank.svg)](https://make.fun/bounty/news-image-20261125)
[![reward](https://make.fun/badge/news-image-20261125/kornztt/news-image-20261125/reward.svg)](https://make.fun/bounty/news-image-20261125)

# The World Today — Wednesday, 25 November 2026

A one-page newspaper front page summing up the world news of
Wednesday, 25 November 2026, drawn entirely by code.

## How it is built

`main.ts` (Node 22 stdlib only, no network) contains a hand-written
software rasterizer, a 5×7 bitmap font and a hand-rolled PNG encoder
(CRC32 + zlib deflate). It draws a 1024×1024 front page — masthead,
hero illustration, headline, two columns and an "IN BRIEF" ticker —
and writes `entry.png`. Two runs produce byte-identical output.

Run it with:

```sh
MAKEFUN_OUTPUT_DIR=. node main.ts
```

## Stories and sources (all first reported on 25 November 2026)

- **Headline — Shenzhou-24 carries Pakistan's first astronaut to
  China's Tiangong station.** Launched 08:18, docked 11:56 Beijing
  time; Muhammad Zeeshan Ali, 40, is the first Pakistani in orbit and
  the first foreign astronaut aboard Tiangong, staying 5–10 days.
  Source: Reuters, 25 Nov 2026 —
  https://www.reuters.com/science/chinas-shenzhou-24-space-flight-takes-off-with-pakistani-national-first-foreign-2026-11-25/
- **The Pacific — Australia and Solomon Islands sign a security
  treaty in Canberra.** Honiara makes Australia its primary security
  partner and says there will be no foreign military base on its soil;
  its China security pact will lapse.
  Sources: Reuters, 25 Nov 2026 —
  https://www.reuters.com/world/china/australia-solomon-islands-sign-security-pact-2026-11-25/ ;
  AP, 25 Nov 2026 —
  https://www.reflector.com/news/national/solomon-islands-signs-treaty-with-australia-that-checks-chinas-influence-in-the-south-pacific/article_d97707e7-9594-528c-9f5c-f474cb777fd4.html ;
  CNN, 25 Nov 2026 —
  https://www.cnn.com/2026/11/24/australia/solomon-islands-australia-security-pact-intl-hnk?cid=external-feeds_iluminar_meta
- **The Gulf — Houthis claim new strikes on Saudi oil and Riyadh.**
  The group said on Wednesday it had attacked the Ras Tanura oil
  refinery and Riyadh's financial district; a day earlier, 11 people
  were wounded in a drone strike on the PIF Tower.
  Source: Reuters, 25 Nov 2026 —
  https://www.reuters.com/world/middle-east/yemens-houthis-say-they-attacked-saudi-oil-refinery-riyadh-financial-district-2026-11-25/
- **In brief — North Korea orders Switzerland's envoy out within
  48 hours** (state media, reported 25 Nov 2026); **Washington is
  poised to unveil new tariffs on 16 trading partners** after the
  Section 301 probe (Reuters, 24–25 Nov 2026 —
  https://www.reuters.com/world/us/trump-administration-set-unveil-new-tariffs-after-probe-on-excess-factory-2026-11-24/);
  **a nor'easter threatens the Thanksgiving parade** (25 Nov 2026 —
  https://www.frequentbusinesstraveler.com/2026/11/george-on-wednesday-noreaster-threatens-thanksgiving-parade-and-travel-new-york-citys-role-in-thanksgiving-cia-reports-security-breach-banks-are-getting-scared-of-ai-agents-inclu/);
  **China opens a graft probe into Shanghai party chief Chen Jining**
  (Reuters, 25 Nov 2026 —
  https://www.reuters.com/world/china/chinas-politburo-shrinks-graft-crackdown-spreads-2026-11-25/).

## License

MIT — see LICENSE.
