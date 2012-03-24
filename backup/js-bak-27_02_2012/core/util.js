/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Miscellaneous utilities
 */

define([ "jquery" ], function ( $ ) { "use strict";
	var util = {};
	
	// From [http://phpjs.org/functions/sprintf:522]
	util.sprintf = function ( /* ... */ ) {
		// http://kevin.vanzonneveld.net
		// +   original by: Ash Searle (http://hexmen.com/blog/)
		// + namespaced by: Michael White (http://getsprink.com)
		// +    tweaked by: Jack
		// +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
		// +      input by: Paulo Freitas
		// +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
		// +      input by: Brett Zamir (http://brett-zamir.me)
		// +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
		// *     example 1: sprintf("%01.2f", 123.1);
		// *     returns 1: 123.10
		// *     example 2: sprintf("[%10s]", 'monkey');
		// *     returns 2: '[    monkey]'
		// *     example 3: sprintf("[%'#10s]", 'monkey');
		// *     returns 3: '[####monkey]'
		var regex = /%%|%(\d+\$)?([-+\'#0 ]*)(\*\d+\$|\*|\d+)?(\.(\*\d+\$|\*|\d+))?([scboxXuidfegEG]|l{0,2}d)/g;
		var a = arguments,
			i = 0,
			format = a[i++];

		// pad()
		var pad = function (str, len, chr, leftJustify) {
			if (!chr) {
				chr = ' ';
			}
			var padding = (str.length >= len) ? '' : Array(1 + len - str.length >>> 0).join(chr);
			return leftJustify ? str + padding : padding + str;
		};

		// justify()
		var justify = function (value, prefix, leftJustify, minWidth, zeroPad, customPadChar) {
			var diff = minWidth - value.length;
			if (diff > 0) {
				if (leftJustify || !zeroPad) {
					value = pad(value, minWidth, customPadChar, leftJustify);
				} else {
					value = value.slice(0, prefix.length) + pad('', diff, '0', true) + value.slice(prefix.length);
				}
			}
			return value;
		};

		// formatBaseX()
		var formatBaseX = function (value, base, prefix, leftJustify, minWidth, precision, zeroPad) {
			// Note: casts negative numbers to positive ones
			var number = value >>> 0;
			prefix = prefix && number && {
				'2': '0b',
				'8': '0',
				'16': '0x'
			}[base] || '';
			value = prefix + pad(number.toString(base), precision || 0, '0', false);
			return justify(value, prefix, leftJustify, minWidth, zeroPad);
		};

		// formatString()
		var formatString = function (value, leftJustify, minWidth, precision, zeroPad, customPadChar) {
			if (precision != null) {
				value = value.slice(0, precision);
			}
			return justify(value, '', leftJustify, minWidth, zeroPad, customPadChar);
		};

		// doFormat()
		var doFormat = function (substring, valueIndex, flags, minWidth, _, precision, type) {
			var number;
			var prefix;
			var method;
			var textTransform;
			var value;

			if (substring == '%%') {
				return '%';
			}

			// parse flags
			var leftJustify = false,
				positivePrefix = '',
				zeroPad = false,
				prefixBaseX = false,
				customPadChar = ' ';
			var flagsl = flags.length;
			for (var j = 0; flags && j < flagsl; j++) {
				switch (flags.charAt(j)) {
				case ' ':
					positivePrefix = ' ';
					break;
				case '+':
					positivePrefix = '+';
					break;
				case '-':
					leftJustify = true;
					break;
				case "'":
					customPadChar = flags.charAt(j + 1);
					break;
				case '0':
					zeroPad = true;
					break;
				case '#':
					prefixBaseX = true;
					break;
				}
			}

			// parameters may be null, undefined, empty-string or real valued
			// we want to ignore null, undefined and empty-string values
			if (!minWidth) {
				minWidth = 0;
			} else if (minWidth == '*') {
				minWidth = +a[i++];
			} else if (minWidth.charAt(0) == '*') {
				minWidth = +a[minWidth.slice(1, -1)];
			} else {
				minWidth = +minWidth;
			}

			// Note: undocumented perl feature:
			if (minWidth < 0) {
				minWidth = -minWidth;
				leftJustify = true;
			}

			if (!isFinite(minWidth)) {
				throw new Error('sprintf: (minimum-)width must be finite');
			}

			if (!precision) {
				precision = 'fFeE'.indexOf(type) > -1 ? 6 : (type == 'd') ? 0 : undefined;
			} else if (precision == '*') {
				precision = +a[i++];
			} else if (precision.charAt(0) == '*') {
				precision = +a[precision.slice(1, -1)];
			} else {
				precision = +precision;
			}

			// grab value using valueIndex if required?
			value = valueIndex ? a[valueIndex.slice(0, -1)] : a[i++];

			switch (type) {
			case 's':
				return formatString(String(value), leftJustify, minWidth, precision, zeroPad, customPadChar);
			case 'c':
				return formatString(String.fromCharCode(+value), leftJustify, minWidth, precision, zeroPad);
			case 'b':
				return formatBaseX(value, 2, prefixBaseX, leftJustify, minWidth, precision, zeroPad);
			case 'o':
				return formatBaseX(value, 8, prefixBaseX, leftJustify, minWidth, precision, zeroPad);
			case 'x':
				return formatBaseX(value, 16, prefixBaseX, leftJustify, minWidth, precision, zeroPad);
			case 'X':
				return formatBaseX(value, 16, prefixBaseX, leftJustify, minWidth, precision, zeroPad).toUpperCase();
			case 'u':
				return formatBaseX(value, 10, prefixBaseX, leftJustify, minWidth, precision, zeroPad);
			case 'i':
			case 'd':
			case "ld":
			case "lld":
				number = (+value) | 0;
				prefix = number < 0 ? '-' : positivePrefix;
				value = prefix + pad(String(Math.abs(number)), precision, '0', false);
				return justify(value, prefix, leftJustify, minWidth, zeroPad);
			case 'e':
			case 'E':
			case 'f':
			case 'F':
			case 'g':
			case 'G':
				number = +value;
				prefix = number < 0 ? '-' : positivePrefix;
				method = ['toExponential', 'toFixed', 'toPrecision']['efg'.indexOf(type.toLowerCase())];
				textTransform = ['toString', 'toUpperCase']['eEfFgG'.indexOf(type) % 2];
				value = prefix + Math.abs(number)[method](precision);
				return justify(value, prefix, leftJustify, minWidth, zeroPad)[textTransform]();
			default:
				return substring;
			}
		};

		return format.replace(regex, doFormat);
	};
	
	// Format various data prettily
	util.format = function ( type, data /* or hour */, minute, sec ) {
		var args = arguments;
		switch ( type ) {
		case "hex":
			return "0x" + data.toString(16).toUpperCase();
		case "time":
			return data/* (hour) */ + ":" + minute + ":" + sec;
		case "bool":
			return data ? "true" : "false";
		default:
			throw new Error( "jQuery.format() :: Error - invalid 'type'" );
		}
	};
	
	// For properly creating a subclass in JavaScript
	util.inherit = function ( cls1, cls2, arg ) {
		if ( !$.isFunction(cls1) ) {
			$.error("$.inherit() :: 'cls1' is not a valid JavaScript class/function");
		}
		if ( !$.isFunction(cls2) ) {
			$.error("$.inherit() :: 'cls2' is not a valid JavaScript class/function");
		}
		// Unfortunately no way to perform "new" & call .apply,
		//	see [http://stackoverflow.com/questions/181348/instantiating-a-javascript-object-by-calling-prototype-constructor-apply]
		cls1.prototype = arg !== undefined ? new cls2( arg ) : new cls2();
		cls1.prototype.constructor = cls1;
	};
	
	// Feature detection
	util.support = (function () {
		// ArrayBuffers are used for efficient memory storage
		var typedArrays = ("ArrayBuffer" in self) && ("Uint8Array" in self);
		
		return {
			typedArrays: typedArrays
			, typedDataView: typedArrays && ("DataView" in self)
		};
	})();
	
	// Safe versions of left- & right-shift
	//	(the builtin operators will convert a > 32-bit value
	//	to zero, so are not safe for some uses)
	util.shl = function ( num, bits ) {
		// (See note in jemul8.generateMask())
		return num * Math.pow(2, bits);
	};
	util.shr = function ( num, bits ) {
		// (See note in jemul8.generateMask())
		return num / Math.pow(2, bits);
	};
	// Create a bitmask for the specified value size in bytes
	//	(eg. for masking off higher bits of a value to fit it
	//	into a CPU register)
	util.generateMask = function ( size /* in bytes */ ) {
		// 4 bytes creates a number that is too large for ECMAScript
		//	(before the -1) ... in FF, the result would be zero,
		//	so we hard-code this particular scenario.
		if ( size < 4 ) {
			return (1 << size * 8) - 1;
		} else {
			return 0xFFFFFFFF;
		}
	};
	// For reinterpreting a number as signed / "sign-extending" a number
	util.signExtend = function ( num, length, lengthTo ) {
		var numBits = length * 8, numBitsTo = lengthTo * 8;
		// Sign bit set
		if ( num >> (numBits - 1) ) {
			// TODO: Convert "<<" to Math.pow() or multiply? May overflow
			//	the JavaScript 32-bit limit...
			return num | ((Math.pow(2, numBitsTo - numBits) - 1) << numBits);
		} else {
			return num;
		}
	};
	
	// Borrow some jQuery's methods
	//  (TODO: Get rid of this - implement our own, to remove
	//  dependency on jQuery)
	util.extend = $.extend;
	util.isFunction = $.isFunction;
	
	if ( !Function.prototype.bind ) {
		// Partial implementation of Function.bind()
		//	(does not support prepending arguments)
		Function.prototype.bind = function ( obj ) {
			var fn = this;
			return function () {
				return fn.apply(obj, arguments);
			};
		};
	}
	
	if ( !Date.now ) {
		Date.now = function () {
			return new Date().getTime();
		};
	}
	
	// Check, because IE10 preview errors on .bind()
	var useBind = false;
	try {
		useBind = self.console && console.assert
		&& console.assert.bind && console.assert.bind(console);
	} catch ( e ) {}
	
	if ( useBind ) {
		util.extend(util, {
			assert: console.assert.bind(console)
			, info: console.info.bind(console)
			, debug: console.debug.bind(console)
			, warning: console.warn.bind(console)
			, problem: console.error.bind(console)
			, panic: function ( msg ) {
				alert(msg);
				throw new Error( msg );
			}
		});
	} else {
		util.extend(util, {
			assert: function ( cond, msg ) {
			}, info: function ( msg ) {
			}, debug: function ( msg ) {
			}, warning: function ( msg ) {
			}, problem: function ( msg ) {
			}, panic: function ( msg ) {
			}
		});
	}
	
	return util;
});
