# TicketRush architecture diagrams

Generated with [drawio-ai-kit](https://github.com/sparklabx/drawio-ai-kit).

## Outputs

Both diagrams are written to `../../docs/architecture/`:

| Profile | Source | Output |
|---|---|---|
| Demo | `build_demo.mjs` | `TicketRush-AWS-Architecture-Demo.drawio` / `.png` |
| Production | `build_production.mjs` | `TicketRush-AWS-Architecture-Production.drawio` / `.png` |

The original architecture is preserved at `docs/architecture/legacy/TicketRush-AWS-Architecture-original.drawio`.

## Regenerate

```bash
cd TicketRushh/diagrams
npm install
npm run build            # both profiles
npm run validate
npm run render           # requires draw.io desktop CLI
```

Per profile:

```bash
npm run build:demo
npm run build:prod
npm run validate:demo
npm run validate:prod
npm run render:demo
npm run render:prod
```

Render on Linux with an extracted/AppImage draw.io binary:

```bash
DRAWIO_CLI=/path/to/drawio npm run render
```

## Demo vs Production

- **Demo**: 1 NAT, no WAF (Shield Standard only), public ALB + `X-Origin-Verify`, ASG 2–4, RDS Multi-AZ, Redis 2 nodes.
- **Production**: WAF + Shield Advanced, 2 NAT, private ALB + CloudFront VPC Origin, RDS Proxy, ASG 3–10, backup/security services, optional cross-region DR.

Both use the same order: `Users → Route 53 → CloudFront → (WAF) → ALB → App → Cache/Redis → RDS`. In the data subnet Redis sits above RDS; production adds RDS Proxy between app and RDS.

The build scripts have no hardcoded coordinates; `drawio-ai-kit` computes the layout from the declared tree.
