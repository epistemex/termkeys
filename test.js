/* *********************************************************
 *
 *  $
 *
 *  Copyright (c) 2021 Epistemex
 *
 **********************************************************/

const { Termkeys, guessTerminal } = require('./index');

const tk = new Termkeys();
tk.DEBUG = true;

console.log('Terminal:', guessTerminal());

// attach to a STDIN /interactive TTY, if none then standard process STDIN is used.
if ( !tk.attach() ) throw new Error('Need an interactive readable stream.');

// add event handler
tk.on('key', callback);

tk.once('key', key => {
  console.log('ONCE');
  //tk.detach();
});

function callback(event) {
  console.log(event);
  if ( event.key === 'SIGINT' ) {
    tk.detach();
    tk.off('key', callback);
  }
}
