#!/usr/bin/env python
"""Seed database with sample data for education platform testing."""

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

# Add project root to path for imports
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


class DatabaseSeeder:
    """Manage database seeding for test data."""

    def __init__(self):
        """Initialize seeder with configuration."""
        self.scripts_dir = Path(__file__).parent
        self.data_dir = self.scripts_dir / "sample_data"
        self.data_dir.mkdir(exist_ok=True)

        self.scripts = [
            ("generate_sample_agents.py", "sample_agents.json", "agents"),
            ("generate_sample_workflows.py", "sample_workflows.json", "workflows"),
            ("generate_sample_datasets.py", "sample_datasets.json", "datasets"),
            ("generate_test_users.py", "test_users.json", "users"),
        ]

        self.stats = {
            "agents": 0,
            "workflows": 0,
            "datasets": 0,
            "users": 0,
            "total_documents": 0,
            "start_time": None,
            "end_time": None,
        }

    def run_script(self, script_name: str) -> bool:
        """Execute a generation script."""
        script_path = self.scripts_dir / script_name

        if not script_path.exists():
            print(f"❌ Script not found: {script_name}")
            return False

        try:
            print(f"🔄 Running {script_name}...")
            result = subprocess.run(
                ["python", str(script_path)],
                capture_output=True,
                text=True,
                cwd=str(self.scripts_dir),
            )

            if result.returncode == 0:
                print(f"✅ {script_name} completed successfully")
                if result.stdout:
                    print(result.stdout.strip())
                return True
            else:
                print(f"❌ {script_name} failed with error:")
                print(result.stderr)
                return False

        except Exception as e:
            print(f"❌ Error running {script_name}: {e}")
            return False

    def load_generated_data(self, filename: str) -> Optional[list[dict[str, Any]]]:
        """Load generated JSON data."""
        file_path = self.scripts_dir / filename

        if not file_path.exists():
            print(f"⚠️  Data file not found: {filename}")
            return None

        try:
            with open(file_path, encoding="utf-8") as f:
                data = json.load(f)
                return data
        except Exception as e:
            print(f"❌ Error loading {filename}: {e}")
            return None

    def move_to_data_dir(self, filename: str) -> bool:
        """Move generated file to sample_data directory."""
        source = self.scripts_dir / filename
        destination = self.data_dir / filename

        if not source.exists():
            return False

        try:
            # Read and write instead of move to preserve original
            with open(source, encoding="utf-8") as f:
                data = json.load(f)

            with open(destination, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            # Optionally remove original
            source.unlink()
            return True
        except Exception as e:
            print(f"❌ Error moving {filename}: {e}")
            return False

    def generate_manifest(self) -> None:
        """Generate manifest file with metadata about seeded data."""
        manifest = {
            "generated_at": datetime.utcnow().isoformat(),
            "environment": "test",
            "version": "1.0.0",
            "statistics": self.stats,
            "files": [],
            "configuration": {
                "database": "postgresql",
                "api_version": "v1",
                "seed_mode": "development",
            },
        }

        # Add file information
        for _, output_file, data_type in self.scripts:
            file_path = self.data_dir / output_file
            if file_path.exists():
                file_info = {
                    "name": output_file,
                    "type": data_type,
                    "size_bytes": file_path.stat().st_size,
                    "records": self.stats.get(data_type, 0),
                    "path": str(file_path.relative_to(self.scripts_dir)),
                }
                manifest["files"].append(file_info)

        # Save manifest
        manifest_path = self.data_dir / "manifest.json"
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

        print(f"📋 Manifest saved to: {manifest_path}")

    def validate_data_integrity(self) -> bool:
        """Validate that all generated data is consistent."""
        print("\n🔍 Validating data integrity...")

        all_valid = True

        # Check all expected files exist
        for _, output_file, _ in self.scripts:
            file_path = self.data_dir / output_file
            if not file_path.exists():
                print(f"  ❌ Missing: {output_file}")
                all_valid = False
            else:
                print(f"  ✅ Found: {output_file}")

        # Validate JSON structure
        for _, output_file, data_type in self.scripts:
            file_path = self.data_dir / output_file
            if file_path.exists():
                try:
                    with open(file_path, encoding="utf-8") as f:
                        data = json.load(f)
                        if isinstance(data, list):
                            print(f"  ✅ Valid JSON: {output_file} ({len(data)} records)")
                            self.stats[data_type] = len(data)
                        else:
                            print(f"  ⚠️  Unexpected format: {output_file}")
                except Exception as e:
                    print(f"  ❌ Invalid JSON in {output_file}: {e}")
                    all_valid = False

        return all_valid

    def seed_database(self) -> bool:
        """Main seeding process."""
        print("=" * 60)
        print("🌱 Database Seeding Process Started")
        print("=" * 60)

        self.stats["start_time"] = datetime.utcnow().isoformat()

        # Step 1: Generate all data
        print("\n📝 Step 1: Generating sample data...")
        generation_results = []

        for script_name, output_file, data_type in self.scripts:
            success = self.run_script(script_name)
            generation_results.append((script_name, success))

            if success:
                # Move to data directory
                self.move_to_data_dir(output_file)

        # Step 2: Validate data
        print("\n📊 Step 2: Validating generated data...")
        validation_success = self.validate_data_integrity()

        # Step 3: Generate manifest
        print("\n📄 Step 3: Generating manifest...")
        self.generate_manifest()

        self.stats["end_time"] = datetime.utcnow().isoformat()

        # Step 4: Summary
        print("\n" + "=" * 60)
        print("📊 Seeding Summary")
        print("=" * 60)

        success_count = sum(1 for _, success in generation_results if success)
        total_count = len(generation_results)

        print(f"✅ Successfully generated: {success_count}/{total_count} datasets")
        print(f"📁 Data directory: {self.data_dir}")
        print("\n📈 Statistics:")
        print(f"  - Agents: {self.stats.get('agents', 0)}")
        print(f"  - Workflows: {self.stats.get('workflows', 0)}")
        print(f"  - Datasets: {self.stats.get('datasets', 0)}")
        print(f"  - Users: {self.stats.get('users', 0)}")

        if validation_success and success_count == total_count:
            print("\n✅ Database seeding completed successfully!")
            return True
        else:
            print("\n⚠️  Database seeding completed with issues.")
            print("Please check the errors above and retry if needed.")
            return False

    def cleanup(self) -> None:
        """Clean up temporary files."""
        print("\n🧹 Cleaning up temporary files...")

        temp_files = [
            "sample_agents.json",
            "sample_workflows.json",
            "sample_datasets.json",
            "test_users.json",
        ]

        for filename in temp_files:
            file_path = self.scripts_dir / filename
            if file_path.exists():
                try:
                    file_path.unlink()
                    print(f"  ✅ Removed: {filename}")
                except Exception as e:
                    print(f"  ⚠️  Could not remove {filename}: {e}")


def main() -> None:
    """Main entry point for database seeding."""
    seeder = DatabaseSeeder()

    try:
        # Run seeding process
        success = seeder.seed_database()

        # Cleanup is now handled by move operation
        # seeder.cleanup()  # Optional: uncomment if you want to remove originals

        if success:
            print("\n🎉 All sample data has been generated successfully!")
            print(f"📂 Check the {seeder.data_dir} directory for generated files.")
            sys.exit(0)
        else:
            print("\n⚠️  Some issues occurred during seeding.")
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n\n⚠️  Seeding interrupted by user.")
        seeder.cleanup()
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        seeder.cleanup()
        sys.exit(1)


if __name__ == "__main__":
    main()