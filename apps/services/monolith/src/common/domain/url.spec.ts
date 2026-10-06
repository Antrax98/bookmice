import { isSafeUrl } from './url';

describe('isSafeUrl', () => {
  it.each(['http://x.com', 'https://x.com/a/b?c=d', 'mailto:yo@x.com'])(
    'acepta %s',
    (url) => {
      expect(isSafeUrl(url)).toBe(true);
    },
  );

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'vbscript:msgbox(1)',
  ])('rechaza %s', (url) => {
    expect(isSafeUrl(url)).toBe(false);
  });

  it.each(['no-es-una-url', '', '   ', '//x.com'])(
    'rechaza lo que no se puede analizar: %s',
    (url) => {
      expect(isSafeUrl(url)).toBe(false);
    },
  );

  it.each([null, undefined, 42, {}, ['http://x.com']])(
    'rechaza lo que no es un string: %p',
    (valor) => {
      expect(isSafeUrl(valor)).toBe(false);
    },
  );

  it('no distingue mayusculas en el esquema', () => {
    expect(isSafeUrl('HTTPS://x.com')).toBe(true);
    expect(isSafeUrl('JavaScript:alert(1)')).toBe(false);
  });
});
