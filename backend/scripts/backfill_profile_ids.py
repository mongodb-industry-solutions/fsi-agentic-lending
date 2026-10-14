"""Backfill ``profile_id`` on seeded applications.

The PDF serve path resolves a document's file by way of its application's
``profile_id`` (see ``routes/documents.py:_resolve_pdf_path``). Every profile
ships identically-named PDFs (``01_government_id.pdf`` and friends), so without
``profile_id`` the lookup falls back to a filename-only search that returns
whichever profile directory sorts first — ``bob-johnson``.

Older seed runs wrote ``profile_id`` only for ``marcus-delgado``. This restores
it for the remaining seeded applications from ``SEED_APPLICATION_IDS``, which is
already the canonical profile -> application mapping.

Idempotent: applications that already carry the right value are left alone.

    uv run python -m scripts.backfill_profile_ids [--dry-run]
"""
import argparse
import logging

from db.mdb import coll
from db.storage_mapping import storage_key
from services.application_service import SEED_APPLICATION_IDS

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def backfill_profile_ids(dry_run: bool = False) -> dict:
    """Set ``profile_id`` on each seeded application that is missing it."""
    apps = coll("applications")
    app_key = storage_key("applications", "application_id")
    profile_key = storage_key("applications", "profile_id")

    updated, already_set, missing = 0, 0, []

    for profile_id, app_id in SEED_APPLICATION_IDS.items():
        # Match either key shape: the BIAN migration is still in flight, so a
        # database may hold `loansId` or the pre-migration `application_id`.
        app = apps.find_one({"$or": [{app_key: app_id}, {"application_id": app_id}]})
        if not app:
            missing.append(f"{app_id} ({profile_id})")
            continue

        # Write back to whichever key this document actually uses, so the
        # backfill cannot introduce a second, conflicting shape.
        key_in_use = app_key if app_key in app else "application_id"
        current = app.get(profile_key) or app.get("profile_id")
        if current == profile_id:
            already_set += 1
            continue

        target = profile_key if key_in_use == app_key else "profile_id"
        if current:
            logger.warning(
                "  %s: profile_id is %r, expected %r — overwriting",
                app_id, current, profile_id,
            )
        if dry_run:
            logger.info("  [dry-run] %s -> %s = %r", app_id, target, profile_id)
        else:
            apps.update_one({"_id": app["_id"]}, {"$set": {target: profile_id}})
            logger.info("  %s -> %s = %r", app_id, target, profile_id)
        updated += 1

    for m in missing:
        logger.warning("  not in database, skipped: %s", m)

    result = {"updated": updated, "already_set": already_set, "missing": len(missing)}
    logger.info(
        "Backfill %s: %d updated, %d already correct, %d absent",
        "preview" if dry_run else "complete",
        updated, already_set, len(missing),
    )
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Report what would change without writing.",
    )
    args = parser.parse_args()
    backfill_profile_ids(dry_run=args.dry_run)
