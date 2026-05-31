import { After, Status } from '@cucumber/cucumber';
import { TestWorld } from './world';

// Preserve the last API payload as a report attachment only when a scenario fails.
After<TestWorld>(function ({ result }) {
    if (result?.status !== Status.FAILED || this.responseBody === undefined) {
        return;
    }

    return this.attach(JSON.stringify(this.responseBody, null, 2), 'application/json');
});
