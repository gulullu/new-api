package common

import (
	"encoding/json"
	"net"
	"sort"
	"strings"
)

// BlockedIPsOptionKey stores the operator-managed source IP blocklist. It is
// persisted through the normal options table so all application instances see
// the same list without a schema migration.
const BlockedIPsOptionKey = "RelayBasesBlockedIPs"

func NormalizeIP(raw string) (string, bool) {
	ip := net.ParseIP(strings.TrimSpace(raw))
	if ip == nil {
		return "", false
	}
	return ip.String(), true
}

func ParseBlockedIPs(raw string) []string {
	var values []string
	if err := json.Unmarshal([]byte(raw), &values); err != nil {
		return nil
	}
	set := make(map[string]struct{}, len(values))
	for _, value := range values {
		if normalized, ok := NormalizeIP(value); ok {
			set[normalized] = struct{}{}
		}
	}
	result := make([]string, 0, len(set))
	for value := range set {
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

func MarshalBlockedIPs(values []string) (string, error) {
	data, err := Marshal(ParseBlockedIPs(stringMustMarshal(values)))
	return string(data), err
}

// stringMustMarshal is only used to normalize a caller-provided list before
// the final marshal; the input is an in-memory slice and cannot fail to encode.
func stringMustMarshal(values []string) string {
	data, _ := json.Marshal(values)
	return string(data)
}

func IsIPBlocked(raw string) bool {
	normalized, ok := NormalizeIP(raw)
	if !ok {
		return false
	}
	OptionMapRWMutex.RLock()
	rawList := ""
	if OptionMap != nil {
		rawList = OptionMap[BlockedIPsOptionKey]
	}
	OptionMapRWMutex.RUnlock()
	for _, blocked := range ParseBlockedIPs(rawList) {
		if blocked == normalized {
			return true
		}
	}
	return false
}
