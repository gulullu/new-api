package common

// MainlandSiteBlockOptionKey controls the Cloudflare Worker website boundary.
// It is stored in the existing options table so all New API instances share
// the same default and no schema migration is required.
const MainlandSiteBlockOptionKey = "RelayBasesMainlandSiteBlockEnabled"
