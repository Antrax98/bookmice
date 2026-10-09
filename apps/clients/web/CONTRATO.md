# Contrato

Avisos de este proyecto que no caben en el `AGENTS.md`, que **lo genera Next.js**
y `next dev` lo reescribe. Por eso este fichero existe aparte: es nuestro, y
nadie lo regenera.

## `maxLength` del openapi son bytes en el servidor, no caracteres

El contrato que sirve el monolith dice, para la contraseña del registro:

```json
"password": { "type": "string", "minLength": 12, "maxLength": 72 }
```

Ese `72` sale de `PASSWORD_LIMITS.maxBytes`, que limita en **bytes** porque es
lo que acepta scrypt. Pero OpenAPI no tiene forma de expresar bytes, así que lo
llama `maxLength`, y `maxLength` son **caracteres**.

**La consecuencia, que no es un bug del contrato:** una contraseña con `ñ` o con
emoji puede pasar la validación del cliente y recibir un **400** del servidor.
40 `ñ` son 40 caracteres y 80 bytes.

### Qué hacer con esto

- **No** pongas `maxLength={72}` en el `TextField` de la contraseña. Estarías
  validando una regla que el servidor no cumple, y el usuario vería rechazada una
  contraseña que el cliente acepta.
- El mínimo sí es comparable: `minLength: 12` son caracteres en los dos lados,
  porque `PASSWORD_LIMITS.minLength` se cuenta en caracteres. Ahí sí puedes
  validar en cliente.
- Si el servidor rechaza la contraseña, el 400 trae el campo `password` en
  `errors[]`. Píntalo bajo el input con `fieldErrorsOf()`, como cualquier otro
  error de validación. No hace caso especial.

### Si el número cambia

El contrato se genera en vivo del backend, así que el número se mueve solo en
cuanto se levante: no hay nada que regenerar a mano. Lo único que puede quedarse
viejo es **este texto**.

Lo que sí puede pasar es que alguien cambie `maxLength` a propósito en el
monolith. Si lo hace, **este párrafo miente**, y hay que actualizarlo. Por eso
el número aparece aquí escrito y no solo referenciado: para que se vea raro
cuando deje de cuadrar.

El aviso completo, con el porqué de los bytes, está en el `AGENTS.md` del
monolith, en *`maxBytes` sale en el openapi como `maxLength`, y no son lo
mismo*.
