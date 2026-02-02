"""Integration tests for unified meeting flow."""

import requests

BASE_URL = 'http://localhost:8000'

def main():
    print('=' * 60)
    print('INTEGRATION TESTS: Unified Meeting Flow')
    print('=' * 60)
    
    passed = 0
    failed = 0
    skipped = 0

    # Test 1: Dashboard flow - Upload meeting WITHOUT project
    print('\n[TEST 1] Dashboard Flow: Upload meeting without project_id')
    try:
        response = requests.post(
            f'{BASE_URL}/api/meetings/upload',
            data={
                'title': 'Test Meeting - Dashboard Flow',
                'meeting_date': '2026-01-30',
                'text': 'Test meeting content. The system should support user authentication.'
            }
        )
        if response.status_code == 201:
            data = response.json()
            meeting_id_no_project = data['meeting_id']
            print(f'  PASS: Meeting created without project (ID: {meeting_id_no_project[:8]}...)')
            passed += 1
        else:
            print(f'  FAIL: Status {response.status_code} - {response.text}')
            failed += 1
            meeting_id_no_project = None
    except Exception as e:
        print(f'  FAIL: {e}')
        failed += 1
        meeting_id_no_project = None

    # Test 2: Verify meeting has no project_id
    print('\n[TEST 2] Verify meeting has no project_id')
    if meeting_id_no_project:
        try:
            response = requests.get(f'{BASE_URL}/api/meetings/{meeting_id_no_project}')
            if response.status_code == 200:
                data = response.json()
                if data.get('project_id') is None:
                    print('  PASS: Meeting has no project_id (as expected)')
                    passed += 1
                else:
                    print(f'  FAIL: Meeting has project_id: {data.get("project_id")}')
                    failed += 1
            else:
                print(f'  FAIL: Status {response.status_code}')
                failed += 1
        except Exception as e:
            print(f'  FAIL: {e}')
            failed += 1
    else:
        print('  SKIP: No meeting ID from previous test')
        skipped += 1

    # Test 3: Create a test project
    print('\n[TEST 3] Create test project')
    try:
        response = requests.post(
            f'{BASE_URL}/api/projects',
            json={'name': 'Test Project for Unified Flow'}
        )
        if response.status_code == 201:
            project_data = response.json()
            project_id = project_data['id']
            print(f'  PASS: Project created (ID: {project_id[:8]}...)')
            passed += 1
        else:
            print(f'  FAIL: Status {response.status_code} - {response.text}')
            failed += 1
            project_id = None
    except Exception as e:
        print(f'  FAIL: {e}')
        failed += 1
        project_id = None

    # Test 4: Associate meeting with project
    print('\n[TEST 4] Associate meeting with project (PATCH endpoint)')
    if meeting_id_no_project and project_id:
        try:
            response = requests.patch(
                f'{BASE_URL}/api/meetings/{meeting_id_no_project}/project',
                data={'project_id': project_id}
            )
            if response.status_code == 200:
                print('  PASS: Meeting associated with project')
                passed += 1
            else:
                print(f'  FAIL: Status {response.status_code} - {response.text}')
                failed += 1
        except Exception as e:
            print(f'  FAIL: {e}')
            failed += 1
    else:
        print('  SKIP: Missing meeting or project ID')
        skipped += 1

    # Test 5: Verify meeting now has project_id
    print('\n[TEST 5] Verify meeting now has project_id')
    if meeting_id_no_project and project_id:
        try:
            response = requests.get(f'{BASE_URL}/api/meetings/{meeting_id_no_project}')
            if response.status_code == 200:
                data = response.json()
                if data.get('project_id') == project_id:
                    print(f'  PASS: Meeting now has project_id')
                    passed += 1
                else:
                    print(f'  FAIL: Unexpected project_id: {data.get("project_id")}')
                    failed += 1
            else:
                print(f'  FAIL: Status {response.status_code}')
                failed += 1
        except Exception as e:
            print(f'  FAIL: {e}')
            failed += 1
    else:
        print('  SKIP: No meeting ID')
        skipped += 1

    # Test 6: Project flow - Upload meeting WITH project
    print('\n[TEST 6] Project Flow: Upload meeting with project_id')
    meeting_id_with_project = None
    if project_id:
        try:
            response = requests.post(
                f'{BASE_URL}/api/meetings/upload',
                data={
                    'title': 'Test Meeting - Project Flow',
                    'meeting_date': '2026-01-30',
                    'project_id': project_id,
                    'text': 'Another test meeting. Users need export to PDF functionality.'
                }
            )
            if response.status_code == 201:
                data = response.json()
                meeting_id_with_project = data['meeting_id']
                print(f'  PASS: Meeting created with project (ID: {meeting_id_with_project[:8]}...)')
                passed += 1
            else:
                print(f'  FAIL: Status {response.status_code} - {response.text}')
                failed += 1
        except Exception as e:
            print(f'  FAIL: {e}')
            failed += 1
    else:
        print('  SKIP: No project ID')
        skipped += 1

    # Test 7: Verify project-flow meeting has project_id set
    print('\n[TEST 7] Verify project-flow meeting has project_id set')
    if meeting_id_with_project:
        try:
            response = requests.get(f'{BASE_URL}/api/meetings/{meeting_id_with_project}')
            if response.status_code == 200:
                data = response.json()
                if data.get('project_id') == project_id:
                    print('  PASS: Meeting has correct project_id')
                    passed += 1
                else:
                    print(f'  FAIL: Unexpected project_id: {data.get("project_id")}')
                    failed += 1
            else:
                print(f'  FAIL: Status {response.status_code}')
                failed += 1
        except Exception as e:
            print(f'  FAIL: {e}')
            failed += 1
    else:
        print('  SKIP: No meeting ID from previous test')
        skipped += 1

    # Test 8: Try to re-associate meeting with different project (should fail)
    print('\n[TEST 8] Prevent re-associating meeting with different project')
    if meeting_id_no_project:
        try:
            # Create another project
            response = requests.post(
                f'{BASE_URL}/api/projects',
                json={'name': 'Another Project'}
            )
            if response.status_code == 201:
                other_project_id = response.json()['id']
                
                # Try to associate meeting with different project
                response = requests.patch(
                    f'{BASE_URL}/api/meetings/{meeting_id_no_project}/project',
                    data={'project_id': other_project_id}
                )
                if response.status_code == 400:
                    print('  PASS: Correctly rejected re-association attempt')
                    passed += 1
                else:
                    print(f'  FAIL: Expected 400, got {response.status_code}')
                    failed += 1
            else:
                print('  SKIP: Could not create second project')
                skipped += 1
        except Exception as e:
            print(f'  FAIL: {e}')
            failed += 1
    else:
        print('  SKIP: No meeting ID')
        skipped += 1

    print('\n' + '=' * 60)
    print(f'RESULTS: {passed} passed, {failed} failed, {skipped} skipped')
    print('=' * 60)
    
    return failed == 0

if __name__ == '__main__':
    import sys
    success = main()
    sys.exit(0 if success else 1)
