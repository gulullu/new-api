/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestWaffoUserEmailPrefersAccountEmail(t *testing.T) {
	user := &model.User{Id: 42, Email: "  User@Example.COM "}

	require.Equal(t, "user@example.com", getWaffoUserEmail(user))
	require.Equal(t, "42@examples.com", getWaffoUserEmail(&model.User{Id: 42}))
	require.Equal(t, "", getWaffoUserEmail(nil))
}

func TestWaffoPancakeBuyerEmailNormalizesAccountEmail(t *testing.T) {
	user := &model.User{Email: "  User@Example.COM "}

	require.Equal(t, "user@example.com", getWaffoPancakeBuyerEmail(user))
	require.Equal(t, "", getWaffoPancakeBuyerEmail(&model.User{}))
}
