/**
 * @jest-environment node
 */

import { getFixedPromptText } from '../lib/prompt.js';
import { validFieldsPayload } from './helpers.js';

describe('prompt', () => {
  it('is built only from server field definitions', () => {
    const clientMarker = validFieldsPayload()[0].description;
    expect(getFixedPromptText()).not.toContain(clientMarker);
    expect(getFixedPromptText()).toContain('amount');
    expect(getFixedPromptText()).toContain('categoryHint');
  });
});
