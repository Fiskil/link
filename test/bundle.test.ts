// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { version } from '../package.json';

it('reports the package version from the built bundle', async () => {
  // A variable path lets tsc run before dist exists.
  const bundlePath = '../dist/fiskil-link.mjs';
  const { link } = (await import(/* @vite-ignore */ bundlePath)) as typeof import('../src');

  const flow = link('session_123');
  const iframe = document.querySelector<HTMLIFrameElement>('iframe[data-fiskil-link-iframe]')!;
  expect(new URL(iframe.src).searchParams.get('sdkVersion')).toBe(version);

  flow.close();
  await expect(flow).rejects.toMatchObject({ code: 'LINK_USER_CANCELLED' });
});
