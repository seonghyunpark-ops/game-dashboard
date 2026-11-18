# MURDERCHAT account directory

The MURDERCHAT tab reads Firebase Authentication accounts independently of transaction history. The admin-only `chatmurderUsageDashboard?view=accounts` endpoint returns 200 users and a next-page cursor. The browser loads every page and filters by name, email, UID, account code, or provider.

The server joins wallet balances, social nicknames, and Play Games links. Apple private relay addresses are labelled explicitly; the original email cannot be recovered. Play Games identity is not a Google email address. Firebase authentication creation/sign-in times are shown; sign-in time is not a live-presence indicator.

No passwords, authentication tokens, or credential hashes are returned. The endpoint uses the existing verified administrator allowlist and no-store responses. Logout and tab changes abort pending requests and remove the account directory. Directory reads never write wallets or create accounts.

Validation: `node --test *.test.mjs`. Backend directory tests and the exact deployed backend source are maintained with the release record in `D:/gamecontry/account-admin-20261118`.
