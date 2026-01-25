# Data Model Migration Notes

This project now uses the following spreadsheet schemas for cars and race entries.

## rapidracers-cars

Column order:

1. `season`
2. `carnumber`
3. `carkey`
4. `carname`
5. `carversion`
6. `carstatus`
7. `carimagepath`
8. `carjsonpath`

Notes:

- `carkey` is an **8-digit string** (never stored as an integer).
- `carnumber` is generated sequentially server-side during garage submission.
- `carversion` starts at `1` for a new car and increments whenever a car is updated.
- `carstatus` starts as `submitted` and may become `approved` via admin actions.
- `carimagepath` points to a single preview PNG in GCS.

## rapidracers-race-entries

Column order:

1. `season`
2. `racenumber`
3. `carnumber`
4. `entrystatus`

Notes:

- Race entry APIs join against `rapidracers-cars` by `carnumber` to fetch car metadata.
- `entrystatus` starts as `entered` (approval is implied by the car's status).

## rapidracers-race-info

Column order:

1. `season`
2. `racenumber`
3. `racename`
4. `racedeadlinedatetime`
5. `racestartdatetime`
6. `racedescription`
7. `raceimage`
8. `racestatus`

Notes:

- `racedeadlinedatetime` is used for the countdown and shown on the site.
- `raceimage` is a GCS path to the race image.
- `racestatus` is one of `finished`, `inactive`, or `active`.

## rapidracers-race-results

Column order (Sheet1):

1. `season`
2. `racenumber`
3. `position`
4. `time`
5. `status`
6. `carnumber`
7. `carname`
8. `notes`