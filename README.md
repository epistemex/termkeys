termkeys
========

Read key presses from an interactive TTY using NodeJS and an event driven architecture.

Supports most VT220 key sequences and newer, incl. modifiers like Shift, Control and Alt on some
keys.

Sends parsed keystrokes as event supporting `key`, `keyCode`, `ctrlKey`,
`shiftKey`, `altKey` and `timestamp` properties in the event object.

Note: The event only mimics JavaScript DOM KeyEvents loosely and aren't fully compatible due to some
limitation to available information in the terminal.

Event keys and key codes are also 'normalized' to produce the same codes in different types of
terminals/shells where possible.

_Help keep the project alive by supporting the developer:_

[![PayPalMe](https://github.com/epistemex/transformation-matrix-js/assets/70324091/04203267-58f0-402b-9589-e2dee6e7c510)](https://paypal.me/KenNil)

Install
-------

In your project, use NPM:

    npm i https://github.com/epistemex/termkeys

Example
-------

```javascript
const Termkeys = require('termkeys');

const tk = new Termkeys();

// attach to a STDIN / interactive TTY, if none then standard process STDIN is used.
if ( !tk.attach() ) throw new Error('Need an interactive readable stream.');

// add event handler
tk.on('key', callback);

function callback(event) {
  console.log(event);
  if ( event.key === 'SIGINT' ) {
    tk.detach();
    tk.off('key', callback);
  }
}
```

API
---

`attach([ReadStream]);` Attach to a readable (and interactive) stream

`detach()` Detaches itself from the stream attached to, and resets state

`on(event, callback)` Listen to event 'key', receive event object as arg

`once(event, callback)` Listen to event 'key' only once, receive event object as arg

`off(event, callback)` Removes an event listener.

Key Object
----------

```json
{
  "key": "<keyname>",
  "keyCode": 0,
  "ctrlKey": false,
  "altKey": false,
  "shiftKey": false,
  "timestamp": 0
}
```

`key` will contain either a single letter, or a key name such as "Delete",
"Insert", "Tab", "Backspace", "F2", "ArrowUp", "Home" and so on.

`keyCode` will be an ASCII/UTF-8 code of the key press.

Note that holding the Shift key to get uppercase A-Z will set `shiftKey` to `true`.

Also note that what keys and modifier keys can be pressed depends on the system the program is
running. In many cases when running in a Desktop Environment, the system or programs running can
capture and consume global key presses before they ever reach the TTY. Therefore, it's wise to use
special keys sparingly or keys that are known to have wide support across systems.

Copyright (c) 2021, 2024 epistemex

![Epistemex](https://i.imgur.com/GP6Q3v8.png)
