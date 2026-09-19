# Changelog

## [1.3.1](https://github.com/zackwag/iptv-catalog/compare/v1.3.0...v1.3.1) (2026-09-19)


### Bug Fixes

* **server:** use named wildcard for SPA fallback route ([#63](https://github.com/zackwag/iptv-catalog/issues/63)) ([6a07800](https://github.com/zackwag/iptv-catalog/commit/6a078008893308099194000975e85468ddf82cd4))

## [1.3.0](https://github.com/zackwag/iptv-catalog/compare/v1.2.0...v1.3.0) (2026-09-17)


### Features

* **test:** add a real test suite ([#60](https://github.com/zackwag/iptv-catalog/issues/60)) ([1da29fd](https://github.com/zackwag/iptv-catalog/commit/1da29fd88139eeeca72748449601cd9185bd9502))
* **test:** add a real test suite (closes [#59](https://github.com/zackwag/iptv-catalog/issues/59)) ([1da29fd](https://github.com/zackwag/iptv-catalog/commit/1da29fd88139eeeca72748449601cd9185bd9502))


### Bug Fixes

* **ci:** name the test job Test to match this account's convention ([#62](https://github.com/zackwag/iptv-catalog/issues/62)) ([6c677a2](https://github.com/zackwag/iptv-catalog/commit/6c677a29476aca55f4d4db97d41f4b21eec01651))

## [1.2.0](https://github.com/zackwag/iptv-catalog/compare/v1.1.1...v1.2.0) (2026-09-17)


### Features

* Adding Linting ([84d7f79](https://github.com/zackwag/iptv-catalog/commit/84d7f794ed953073c3e9029634a5a95041149d05))
* channel number assignment toggle, ESLint/Prettier/Husky setup, fix CI Node version and lock files ([36f33ae](https://github.com/zackwag/iptv-catalog/commit/36f33ae1069b122600b8397419ffacce36fdbd6c))
* channel number assignment toggle, ESLint/Prettier/Husky setup, fix CI Node version and lock files ([e22e1dd](https://github.com/zackwag/iptv-catalog/commit/e22e1dd67fb257be256827bda03301045a2b6a9b))
* **ci:** adopt release-please ([#52](https://github.com/zackwag/iptv-catalog/issues/52)) ([7db9773](https://github.com/zackwag/iptv-catalog/commit/7db9773e2a87e6fdf93af6aca38b6f9fb5c4ad53))
* pin selected channels to top of table across pages ([614a400](https://github.com/zackwag/iptv-catalog/commit/614a400747c3ac4b794d7e51983468d7e75f06be))
* playlist membership indicator and quick-add from channel detail ([a233ec6](https://github.com/zackwag/iptv-catalog/commit/a233ec6297c387a33c3ad540c2de4d9b5346c64c))
* searchable country blocklist, normalize blocked tag display ([1487c65](https://github.com/zackwag/iptv-catalog/commit/1487c65926a235926e3c1874710042557492ac0e))
* searchable multi-select for block categories (matches country block UX) ([39b94cf](https://github.com/zackwag/iptv-catalog/commit/39b94cfc1ea56315d62625a996d3fa4b61e69fb3))
* stream proxy rules — route matching streams through a proxy ([194dde6](https://github.com/zackwag/iptv-catalog/commit/194dde6d50f913653b37d26c2605ff8059bb11fe))


### Bug Fixes

* add ES2022.Error lib for Error cause support ([51db4eb](https://github.com/zackwag/iptv-catalog/commit/51db4eb6bae9c0763f900b10137fbf4a05ecf613))
* **ci:** drop the package-name tag prefix so it stays vX.Y.Z ([#56](https://github.com/zackwag/iptv-catalog/issues/56)) ([8980381](https://github.com/zackwag/iptv-catalog/commit/89803817757ba7ed9c0ad3a84ae34f934f045e2d))
* **ci:** use RELEASE_PLEASE_TOKEN so releases trigger downstream workflows ([#54](https://github.com/zackwag/iptv-catalog/issues/54)) ([c6e17c0](https://github.com/zackwag/iptv-catalog/commit/c6e17c08e521c265174cd579d5a76ab186623039))
* **deps:** support ESM-only node-fetch/uuid/proxy-agent packages ([#58](https://github.com/zackwag/iptv-catalog/issues/58)) ([094b56c](https://github.com/zackwag/iptv-catalog/commit/094b56c39d2fcc80d7091e02509eaa21fb907c45))
* four bugs from code review ([ba562cb](https://github.com/zackwag/iptv-catalog/commit/ba562cbf879468142bb32fcd4f9f9ca64e21fefa))
* guard husky prepare script without external dependency ([2449591](https://github.com/zackwag/iptv-catalog/commit/2449591d48986e1f65d5b299a293f3b3b3c96a71))
* Manually seeding node version ([8f7df68](https://github.com/zackwag/iptv-catalog/commit/8f7df68f259a772868e5ce333d21ded2226499d8))
* prevent iOS Safari auto-zoom on input focus ([8a5978f](https://github.com/zackwag/iptv-catalog/commit/8a5978fb8c50ff8be87bc6df5e6f4cb8f063a030))
* push-to-dvr type HLS, add Docker Hub publish workflow ([fa5e885](https://github.com/zackwag/iptv-catalog/commit/fa5e885a677dcad6d132e44709821c6eec2b7826))
* push-to-dvr type HLS, add Docker Hub publish workflow ([ab2e1b0](https://github.com/zackwag/iptv-catalog/commit/ab2e1b0a92ad09693c4e91dca4432c351f07ae14))
* remove invalid FTS5 upsert ([baabe40](https://github.com/zackwag/iptv-catalog/commit/baabe40fb7d604343a701cbc03005a28975565e1))
* remove invalid FTS5 upsert ([ea8c63d](https://github.com/zackwag/iptv-catalog/commit/ea8c63ddf91f04303e54d31491e59b80d1e7e503))
* skip husky in CI and Docker builds ([d22667c](https://github.com/zackwag/iptv-catalog/commit/d22667cd83c6f056d73e8d85005ad04faff2980d))
* Updating release script ([a24c14a](https://github.com/zackwag/iptv-catalog/commit/a24c14aaf403df36699ddad745af6fd0c64d5c61))
* use FTS5 rebuild command to prevent index corruption ([c1a4eec](https://github.com/zackwag/iptv-catalog/commit/c1a4eecb76169e58619ba0cc59f2cd111836c0d8))
* use FTS5 rebuild command to prevent index corruption ([9c23be5](https://github.com/zackwag/iptv-catalog/commit/9c23be534e5824d704daa3a00f06d7f43f3cf26f))
* use FTS5 rebuild command to prevent index corruption ([26097f3](https://github.com/zackwag/iptv-catalog/commit/26097f3098f16325ddfc533764d4b6e4e30a62a2))

## [1.1.1](https://github.com/zackwag/iptv-catalog/compare/iptv-catalog-api-v1.1.0...iptv-catalog-api-v1.1.1) (2026-09-17)


### Bug Fixes

* **ci:** use RELEASE_PLEASE_TOKEN so releases trigger downstream workflows ([#54](https://github.com/zackwag/iptv-catalog/issues/54)) ([c6e17c0](https://github.com/zackwag/iptv-catalog/commit/c6e17c08e521c265174cd579d5a76ab186623039))

## [1.1.0](https://github.com/zackwag/iptv-catalog/compare/iptv-catalog-api-v1.0.13...iptv-catalog-api-v1.1.0) (2026-09-17)


### Features

* Adding Linting ([84d7f79](https://github.com/zackwag/iptv-catalog/commit/84d7f794ed953073c3e9029634a5a95041149d05))
* channel number assignment toggle, ESLint/Prettier/Husky setup, fix CI Node version and lock files ([36f33ae](https://github.com/zackwag/iptv-catalog/commit/36f33ae1069b122600b8397419ffacce36fdbd6c))
* channel number assignment toggle, ESLint/Prettier/Husky setup, fix CI Node version and lock files ([e22e1dd](https://github.com/zackwag/iptv-catalog/commit/e22e1dd67fb257be256827bda03301045a2b6a9b))
* **ci:** adopt release-please ([#52](https://github.com/zackwag/iptv-catalog/issues/52)) ([7db9773](https://github.com/zackwag/iptv-catalog/commit/7db9773e2a87e6fdf93af6aca38b6f9fb5c4ad53))
* pin selected channels to top of table across pages ([614a400](https://github.com/zackwag/iptv-catalog/commit/614a400747c3ac4b794d7e51983468d7e75f06be))
* playlist membership indicator and quick-add from channel detail ([a233ec6](https://github.com/zackwag/iptv-catalog/commit/a233ec6297c387a33c3ad540c2de4d9b5346c64c))
* searchable country blocklist, normalize blocked tag display ([1487c65](https://github.com/zackwag/iptv-catalog/commit/1487c65926a235926e3c1874710042557492ac0e))
* searchable multi-select for block categories (matches country block UX) ([39b94cf](https://github.com/zackwag/iptv-catalog/commit/39b94cfc1ea56315d62625a996d3fa4b61e69fb3))
* stream proxy rules — route matching streams through a proxy ([194dde6](https://github.com/zackwag/iptv-catalog/commit/194dde6d50f913653b37d26c2605ff8059bb11fe))


### Bug Fixes

* add ES2022.Error lib for Error cause support ([51db4eb](https://github.com/zackwag/iptv-catalog/commit/51db4eb6bae9c0763f900b10137fbf4a05ecf613))
* four bugs from code review ([ba562cb](https://github.com/zackwag/iptv-catalog/commit/ba562cbf879468142bb32fcd4f9f9ca64e21fefa))
* guard husky prepare script without external dependency ([2449591](https://github.com/zackwag/iptv-catalog/commit/2449591d48986e1f65d5b299a293f3b3b3c96a71))
* Manually seeding node version ([8f7df68](https://github.com/zackwag/iptv-catalog/commit/8f7df68f259a772868e5ce333d21ded2226499d8))
* prevent iOS Safari auto-zoom on input focus ([8a5978f](https://github.com/zackwag/iptv-catalog/commit/8a5978fb8c50ff8be87bc6df5e6f4cb8f063a030))
* push-to-dvr type HLS, add Docker Hub publish workflow ([fa5e885](https://github.com/zackwag/iptv-catalog/commit/fa5e885a677dcad6d132e44709821c6eec2b7826))
* push-to-dvr type HLS, add Docker Hub publish workflow ([ab2e1b0](https://github.com/zackwag/iptv-catalog/commit/ab2e1b0a92ad09693c4e91dca4432c351f07ae14))
* remove invalid FTS5 upsert ([baabe40](https://github.com/zackwag/iptv-catalog/commit/baabe40fb7d604343a701cbc03005a28975565e1))
* remove invalid FTS5 upsert ([ea8c63d](https://github.com/zackwag/iptv-catalog/commit/ea8c63ddf91f04303e54d31491e59b80d1e7e503))
* skip husky in CI and Docker builds ([d22667c](https://github.com/zackwag/iptv-catalog/commit/d22667cd83c6f056d73e8d85005ad04faff2980d))
* Updating release script ([a24c14a](https://github.com/zackwag/iptv-catalog/commit/a24c14aaf403df36699ddad745af6fd0c64d5c61))
* use FTS5 rebuild command to prevent index corruption ([c1a4eec](https://github.com/zackwag/iptv-catalog/commit/c1a4eecb76169e58619ba0cc59f2cd111836c0d8))
* use FTS5 rebuild command to prevent index corruption ([9c23be5](https://github.com/zackwag/iptv-catalog/commit/9c23be534e5824d704daa3a00f06d7f43f3cf26f))
* use FTS5 rebuild command to prevent index corruption ([26097f3](https://github.com/zackwag/iptv-catalog/commit/26097f3098f16325ddfc533764d4b6e4e30a62a2))

## [1.0.13] - 2026-07-19

- Add named VPN/geo-proxy endpoints with per-channel routing (#2)
- Update package-lock.json

## [1.0.12] - 2026-07-12

- Updating package files
- feat: stream proxy rules — route matching streams through a proxy


## [1.0.11] - 2026-07-12

- Update package-lock.json
- feat: searchable multi-select for block categories (matches country block UX)


## [1.0.10] - 2026-07-12

- Update package-lock.json
- fix: four bugs from code review


## [1.0.9] - 2026-07-12

- fix: prevent iOS Safari auto-zoom on input focus
- fix: guard husky prepare script without external dependency
- fix: skip husky in CI and Docker builds


## [1.0.8] - 2026-07-11

- feat: channel number assignment toggle, ESLint/Prettier/Husky setup, fix CI Node version and lock files
- feat: Adding Linting


## [1.0.7] - 2026-07-11

- feat: playlist membership indicator and quick-add from channel detail


## [1.0.6] - 2026-07-11

- feat: searchable country blocklist, normalize blocked tag display


## [1.0.5] - 2026-07-11

- feat: pin selected channels to top of table across pages
- fix: Updating release script


## [1.0.4] - 2026-07-11

- fix: use FTS5 rebuild command to prevent index corruption
- fix: use FTS5 rebuild command to prevent index corruption



## [1.0.3] - 2026-07-11

- ci: build amd64 only to avoid QEMU OOM on arm64
- fix: use FTS5 rebuild command to prevent index corruption



## [1.0.2] - 2026-07-11

- fix: Manually seeding node version
- fix: remove invalid FTS5 upsert
- fix: push-to-dvr type HLS, add Docker Hub publish workflow
- fix: remove invalid FTS5 upsert
