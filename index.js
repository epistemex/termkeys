/* *********************************************************
 *
 *  termkeys
 *
 *  Copyright (c) 2021 Epistemex
 *
 **********************************************************/

'use strict';

const EventEmitter = require('events');

const binaries = [ // ASCII 0-31
  'NUL', 'SOH', 'STX', 'SIGINT' /*ETX*/, 'EOT', 'ENQ', 'ACK', 'BEL', 'Backspace' /*BS*/,
  'Tab' /*TAB*/, 'EOT', 'VT', 'FF', 'Enter' /*LF*/, 'SO', 'SI', 'DLE', 'DC1', 'DC2', 'DC3',
  'DC4', 'NAK', 'SYN', 'ETB', 'CAN', 'EM', 'SUB', 'Escape' /*ESC*/, 'FS', 'GS', 'RS', 'US'
];

function guessTerminal() {
  const env = process.env;
  if (typeof env.KONSOLE_VERSION === 'string') return 'konsole';
  else if (typeof env.TERMINAL_EMULATOR === 'string') return env.TERMINAL_EMULATOR.toLowerCase();
  else if (typeof env.TERM === 'string') {
    const term = env.TERM.toLowerCase();
    return term.startsWith('xterm') ? 'xterm' : term;   // 'linux' (system)
  }
  else return 'unknown'
}

function Termkeys(options = {}) {
  options = Object.assign({}, {
    resume: true
  }, options);

  const ee = new EventEmitter();

  this._wasRaw = false;
  this._wasEnc = null;

  this.stream = null;
  this.DEBUG = false;

  function _isUpperCase(c) {
    return /[A-Z]|[\u0080-\u024F]/.test(c) && c === c.toUpperCase();
  }

  function _isReadableStream(stream) {
    return stream !== null
      && typeof stream === 'object'
      && typeof stream.pipe === 'function'
      && stream.readable !== false
      && typeof stream._read === 'function'
      && typeof stream._readableState === 'object';
  }

  //noinspection JSValidateTypes
  /**
   * Attach key handler to a Readable Stream such as `process.stdin`
   * @param {ReadStream} [stdin=process.stdin] - interactive readable stream to attach to.
   * Defaults to `process.stdin` if none is given.
   * @param {*} [encoding='utf8'] - optionally set encoding
   * @returns {boolean} if false the ReadStream was either wrong type or not interactive.
   */
  this.attach = (stdin = process.stdin, encoding = 'utf8') => {
    if ( !this.stream && _isReadableStream(stdin) && stdin.isTTY ) {
      this._wasRaw = stdin.isRaw;
      this._wasEnc = stdin.readableEncoding;
      if ( !stdin.isRaw ) stdin.setRawMode(true);
      if ( options.resume ) stdin.resume();
      stdin.setEncoding(encoding);  // note: this hands us a String instead of a Buffer to our handler
      stdin.on('data', _handler.bind(this));

      this.stream = stdin;
    }
    return !!this.stream;
  };

  /**
   * Remove key handler from stream. Resets stream.
   * The instance can be reused.
   */
  this.detach = () => {
    if ( this.stream && _isReadableStream(this.stream) ) {
      this.stream.setRawMode(this._wasRaw);
      this.stream.setEncoding(this._wasEnc);
      if ( options.resume ) this.stream.pause();
      this.stream = null;
    }
  };

  /**
   * Add an event listener for keys
   * @param {String} event - listen to this event, currently only "key"
   * @param {Function} callback - callback function to receive the key event object.
   */
  this.on = (event, callback) => {
    if ( event === 'key' ) ee.on(event, callback);
    else console.error('Unknown event name.');
  };

  /**
   * Add an event listener for keys, but only once.
   * @param {String} event - listen to this event, currently only "key"
   * @param {Function} callback - callback function to receive the key event object.
   */
  this.once = (event, callback) => {
    if ( event === 'key' ) ee.once(event, callback);
    else console.error('Unknown event name.');
  };

  /**
   * Remove an event listener using the same type and callback function as arguments.
   * @param {String} event - remove from this event, currently only "key"
   * @param {Function} callback - callback function used to receive the key event object.
   */
  this.off = (event, callback) => {
    if ( event === 'key' ) ee.off(event, callback);
    else console.error('Unknown event name.');
  };

  /*------------------------------------------------------------------------------------------------

    HANDLER

  ------------------------------------------------------------------------------------------------*/

  function _handler(seq) {
    //noinspection JSPotentiallyInvalidUsageOfThis
    if ( this.DEBUG ) printSeq(seq);

    function _emit(o) {
      o = Object.assign({ key: '', keyCode: null, ctrlKey: false, altKey: false, shiftKey: false, timestamp: Date.now() }, o);
      ee.emit('key', o);
    }

    if ( seq.length === 1 ) {
      const keyCode = seq.charCodeAt(0);

      if ( keyCode < 32 ) {
        _emit({ key: binaries[ keyCode ], keyCode });
      }
      else if ( keyCode === 127 || keyCode === 8 ) {
        // TODO this is a bit weird, 127 is the code for Delete, not BS. KAE
        _emit({ key: 'Backspace', keyCode: 8 });
      }
      else {
        _emit({ key: seq, keyCode, shiftKey: _isUpperCase(seq) });
      }

    }
    else if ( seq[ 0 ] === '\x1b' ) {

      /*------------------------------------------------------------------------
        CSI Sequences
      ------------------------------------------------------------------------*/
      if ( seq[ 1 ] === '[' ) {
        let fn;
        let fnn = 0;
        let ctrlKey = false;
        let shiftKey = false;
        let altKey = false;
        let terminator = seq[ seq.length - 1 ];
        seq = seq.substring(2, seq.length - 1);

        const parts = seq.split(';');
        fn = parts[ 0 ];
        if ( parts.length === 1 ) {
          fnn = +parts[ 0 ];
        }
        else if ( parts.length === 2 ) {
          shiftKey = parts[ 1 ] === '2'  || parts[ 1 ] === '4'|| parts[ 1 ] === '6';
          altKey = parts[ 1 ] === '3'  || parts[ 1 ] === '4'|| parts[ 1 ] === '7';
          ctrlKey = parts[ 1 ] === '5' || parts[ 1 ] === '6' || parts[ 1 ] === '7';
          if ( !isNaN(fn) ) fnn = +fn;
        }
        else {
          console.error('***UNHANDLED CSI PARTS:', parts);
        }

        // CSI single char sequences
        if (!seq.length || seq.length === 3) {
          switch( terminator ) {
            case 'A':
              return _emit({ key: 'ArrowUp', keyCode: 38, ctrlKey, altKey, shiftKey });
            case 'B':
              return _emit({ key: 'ArrowDown', keyCode: 40, ctrlKey, altKey, shiftKey });
            case 'C':
              return _emit({ key: 'ArrowRight', keyCode: 39, ctrlKey, altKey, shiftKey });
            case 'D':
              return _emit({ key: 'ArrowLeft', keyCode: 37, ctrlKey, altKey, shiftKey });
            case 'E':
            case 'G':
              return _emit({ key: 'Enter', keyCode: 13, ctrlKey, altKey, shiftKey });
            case 'F':
              return _emit({ key: 'End', keyCode: 35, ctrlKey, altKey, shiftKey });
            case 'H':
              return _emit({ key: 'Home', keyCode: 36, ctrlKey, altKey, shiftKey });
            case 'P':
              return _emit({ key: 'VK_PAUSE' });
            case 'Z':
              return _emit({ key: 'Tab', keyCode: 9, shiftKey: true });
            case '~':
              const p = seq.split(';');
              if (fnn === 2) {
                if (p.length === 2) {
                  if (p[1] === '2') return _emit({ key: 'Insert', keyCode: 45, shiftKey: true, ctrlKey, altKey });
                  else if (p[1] === '3') return _emit({ key: 'Insert', keyCode: 45, shiftKey, ctrlKey, altKey: true });
                  else if (p[1] === '5') return _emit({ key: 'Insert', keyCode: 45, shiftKey, ctrlKey: true, altKey });
                }
              }
              // PageUp/Down
              else if ( fnn >= 5 && fnn <= 6 ) {
                if (fnn === 5) return _emit({ key: 'PageUp', keyCode: 33, shiftKey, ctrlKey, altKey });
                else if (fnn === 6) return _emit({ key: 'PageDown', keyCode: 34, shiftKey, ctrlKey, altKey });
              }
              else if ( fnn === 15 ) return _emit({ key: 'F5', keyCode: 116, shiftKey, ctrlKey, altKey });
              else if ( fnn >= 17 && fnn <= 34 ) {
                // patch for gaps in the CSI sequence
                if ( fnn > 29 ) fnn--;
                if ( fnn > 26 ) fnn--;
                if ( fnn > 21 ) fnn--;

                return _emit({ key: `F${ fnn - 11 }`, keyCode: 100 + fnn, shiftKey, ctrlKey, altKey });
              }
              else console.error('***UNHANDLED CSI ~ FIXED:', seq, terminator, fnn);
              return
            default:
              printSeq(seq);
          }
        }
        // TERMINAL_EMULATOR=JetBrains-JediTerm
//        else if (seq === '2' || seq === '3' || seq === '5' || seq === '6' || seq === '7') {
//          shiftKey = seq === '2' || seq === '6';
//          altKey = seq === '3' || seq === '7';
//          ctrlKey = seq === '5' || seq === '6' || seq === '7';
//
//          switch( terminator ) {
//            case 'A':
//              return _emit({ key: 'ArrowUp', keyCode: 38, ctrlKey, altKey, shiftKey });
//            case 'B':
//              return _emit({ key: 'ArrowDown', keyCode: 40, ctrlKey, altKey, shiftKey });
//            case 'C':
//              return _emit({ key: 'ArrowRight', keyCode: 39, ctrlKey, altKey, shiftKey });
//            case 'D':
//              return _emit({ key: 'ArrowLeft', keyCode: 37, ctrlKey, altKey, shiftKey });
//            case 'H':
//              return _emit({ key: 'Home', keyCode: 36, ctrlKey, altKey, shiftKey });
//            case '~':
//              return _emit({ key: 'Insert', keyCode: 45, shiftKey: false, ctrlKey: false, altKey: false });
//            default:
//              console.error('UNHANDLED SEQ=1:', seq, terminator);
//          }
//        }
        // CSI [[A to E (Fn keys)
        else if (seq === '[') {
          switch( terminator ) {
            case 'A':
              return _emit({ key: 'F1', keyCode: 112, ctrlKey, altKey, shiftKey });
            case 'B':
              return _emit({ key: 'F2', keyCode: 113, ctrlKey, altKey, shiftKey });
            case 'C':
              return _emit({ key: 'F3', keyCode: 114, ctrlKey, altKey, shiftKey });
            case 'D':
              return _emit({ key: 'F4', keyCode: 115, ctrlKey, altKey, shiftKey });
            case 'E':
              return _emit({ key: 'F5', keyCode: 116, ctrlKey, altKey, shiftKey });
            default:
              printSeq(seq);
          }
        }
        // CSI [x[;x]~ Fn keys, INS, DEL, HOME etc.
        else if (terminator === '~'){
          if ( fnn === 15 ) _emit({ key: 'F5', keyCode: 116, shiftKey, ctrlKey, altKey });
          else if ( fnn >= 17 && fnn <= 34 ) {
            // patch for holes in the CSI sequence
            if ( fnn > 29 ) fnn--;
            if ( fnn > 26 ) fnn--;
            if ( fnn > 21 ) fnn--;

            _emit({ key: `F${ fnn - 11 }`, keyCode: 100 + fnn, shiftKey, ctrlKey, altKey });
          }
          else if ( fnn === 1 ) _emit({ key: 'Home', keyCode: 36, shiftKey, ctrlKey, altKey });
          else if ( fnn === 2 ) _emit({ key: 'Insert', keyCode: 45, shiftKey, ctrlKey, altKey });
          else if ( fnn === 3 ) _emit({ key: 'Delete', keyCode: 127, shiftKey, ctrlKey, altKey });
          else if ( fnn === 4 ) _emit({ key: 'End', keyCode: 35, shiftKey, ctrlKey, altKey });
          else if ( fnn === 5 ) _emit({ key: 'PageUp', keyCode: 33, shiftKey, ctrlKey, altKey });
          else if ( fnn === 6 ) _emit({ key: 'PageDown', keyCode: 34, shiftKey, ctrlKey, altKey });
          else console.error('***UNHANDLED CSI ~ VARI:', seq, terminator);
        }
      }
      /*------------------------------------------------------------------------
        ESC sequences
      ------------------------------------------------------------------------*/
      // ESC OM from the keypad ('5' key)
      else if ( seq.substr(1) === 'OM' ) {
        return _emit({ key: 'Enter', keyCode: 13, shiftKey: true });
      }
      // ESC version of Shift + TAB
      else if ( seq.substr(1) === '\t' ) {
        return _emit({ key: 'Tab', keyCode: 9, shiftKey: true });
      }
      // ESC PF1-4 (F1-F4)
      else if ( seq.length >= 3 && seq.length <= 4 && seq[ 1 ] === 'O' ) {
        const terminator = seq[ seq.length - 1 ];
        const q = seq[ 2 ];
        const shiftKey = seq.length === 4 && q === '2';
        const altKey = seq.length === 4 && q === '3';
        const ctrlKey = seq.length === 4 && q === '5';

        switch( terminator ) {
          case 'P':
            return _emit({ key: 'F1', keyCode: 112, shiftKey, ctrlKey, altKey });
          case 'Q':
            return _emit({ key: 'F2', keyCode: 113, shiftKey, ctrlKey, altKey });
          case 'R':
            return _emit({ key: 'F3', keyCode: 114, shiftKey, ctrlKey, altKey });
          case 'S':
            return _emit({ key: 'F4', keyCode: 115, shiftKey, ctrlKey, altKey });
        }
      } // end ESC (PF1-4)

    } // end ESC introducer
  } // end _handler()

}

// for debugging
function printSeq(seq, cmt = '') {
  let out = `\x1b[1;31mDEBUG: ${ cmt.length ? '(' + cmt + ')' : '' }`;
  for(let ch of seq) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code === 127) {
      out += `\x1b[33m(\x1b[37m${ code }\x1b[33m)\x1b[0m`;
    }
    else out += `\x1b[32m${ ch }\x1b[0m`;
  }
  process.stderr.write(out + '\r\n');
}

module.exports = { guessTerminal, Termkeys };