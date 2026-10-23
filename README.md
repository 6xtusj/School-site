# Nigerian Secondary School Management System — Local MVP

A starter application for a single Nigerian secondary school (JSS1–SS3). It runs locally with Node.js and SQLite. It includes login, role-based navigation, student records, attendance, marks/results, fee payments, and demo accounts for the main school roles.

## Requirements
- Node.js 20 or newer
- Internet connection for the first `npm install` only

## Run on Windows
1. Extract this ZIP to a folder, for example `C:\school-system`.
2. Open that folder in File Explorer.
3. Click the address bar, type `cmd`, and press Enter.
4. Run:
   ```bash
   npm install
   npm start
   ```
5. Open `http://localhost:3000` in your browser.

To stop the server, return to the Command Prompt and press `Ctrl + C`.

## Run on macOS/Linux
Open Terminal in the extracted folder and run:
```bash
npm install
npm start
```
Then open `http://localhost:3000`.

## Demo login accounts
All demo accounts use the password: `School@123`

| Role | Username |
|---|---|
| School Administrator | `admin` |
| Principal | `principal` |
| Teacher | `teacher` |
| Accountant / Bursar | `accountant` |
| Examination Officer | `examofficer` |
| Parent / Guardian | `parent` |
| Student | `student` |

The demo accounts are for local testing only. Change or remove them before any real deployment.

## What works in this MVP
- Login/logout and role-based page access
- Dashboard summary
- Add and view student records
- Record attendance
- Enter and view assessment marks
- Record fee payments and see payment history
- SQLite data persists in `school.db`
- Nigerian class levels, terms, and naira currency

## Important limitations
This is a **local MVP**, not a production-ready school platform. It is not yet a complete implementation of every module in the project blueprint. Online payment gateway verification, parent-child linking, PDF report cards, CBT, WAEC/NECO practice content, library circulation, SMS, cloud deployment, account management, password reset, automated backups, and full audit reporting still need to be built and tested.

The current demo uses a simple session setup suitable only for local development. Do not expose this server to the internet or use real student/financial data until security hardening, access-control testing, backups, privacy review, and production session configuration are completed.

## Data
The database is created automatically the first time the server starts. To reset the demo database, stop the server and delete `school.db`; the sample data will be recreated at next startup.
