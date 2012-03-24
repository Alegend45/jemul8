/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: Miscellaneous utilities
 */
var isIE = window.ActiveXObject && !window.opera;

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("util", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
	// From [http://phpjs.org/functions/sprintf:522]
	jemul8.sprintf = function ( /* ... */ ) {
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
		var regex = /%%|%(\d+\$)?([-+\'#0 ]*)(\*\d+\$|\*|\d+)?(\.(\*\d+\$|\*|\d+))?([scboxXuidfegEG])/g;
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
	
	// For properly creating a subclass in JavaScript
	$.inherit = function ( cls1, cls2, arg ) {
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
	jemul8.support = (function () {
		// ArrayBuffers are used for efficient memory storage
		var typedArrays = ("ArrayBuffer" in self) && ("Uint8Array" in self);
		
		return {
			typedArrays: typedArrays
			, typedDataView: typedArrays && ("DataView" in self)
		};
	})();
	// Allocates a multi-byte capable memory buffer for data storage
	jemul8.createBuffer = function ( len ) {
		var mem;
		// Ultra-modern, fast Typed Arrays support (faster)
		if ( jemul8.support.typedArrays ) {
			return new ArrayBuffer( len );
		/** TODO: Support ImageData for slightly older browsers
			(off Canvas context) **/
		// Legacy native Arrays support (slower)
		} else {
			mem = new Array( len );
			// Zero-out all bytes in memory (otherwise they will be undefined)
			//for ( var i = 0 ; i < len ; ++i ) {
			//	mem[ i ] = 0x00;
			//}
			return mem;
		}
	};
	// Wraps an ArrayBuffer with a Uint8Array view
	jemul8.wrapByteBuffer = function ( buf ) {
		// Wrapping only applies where there is ArrayBuffer support
		if ( !jemul8.support.typedArrays ) { return buf; }
		
		return new Uint8Array( buf );
	};
	// Wraps an ArrayBuffer with the most optimised view
	//	suitable & available for being multibyte-capable
	//	(ie. supporting .getUint8()/.getUint16()/.getUint32())
	jemul8.wrapMultibyteBuffer = function ( buf ) {
		// Wrapping only applies where there is ArrayBuffer support
		if ( !jemul8.support.typedArrays ) { return buf; }
		
		// If eg. buffer will be mapped for direct guest access
		//	in /classes/memory.js, DataView should be faster
		//	for reading multi-byte values
		return new
			(jemul8.support.typedDataView ? DataView : Uint8Array)
			( buf );
	};
	// Helper for easily creating Uint8Array-wrapped buffers
	jemul8.createByteBuffer = function ( len ) {
		return this.wrapByteBuffer(this.createBuffer(len));
	};
	// For wiping a buffer
	jemul8.zeroBuffer = function ( buf ) {
		var len;
		if ( jemul8.support.typedArrays ) {
			new Uint8Array( buf ).set(new Uint8Array( buf.byteLength ) );
		} else {
			// Wipe the data by emptying the array,
			//	then restore the length (remember that "undefined"
			//	will be the value of each element, not a zero!!!)
			len = buf.length;
			buf.length = 0;
			buf.length = len;
		}
	};
	
	// Safe versions of left- & right-shift
	//	(the builtin operators will convert a > 32-bit value
	//	to zero, so are not safe for some uses)
	jemul8.shl = function ( num, bits ) {
		// (See note in jemul8.generateMask())
		return num * Math.pow(2, bits);
	};
	jemul8.shr = function ( num, bits ) {
		// (See note in jemul8.generateMask())
		return num / Math.pow(2, bits);
	};
	// Create a bitmask for the specified value size in bytes
	//	(eg. for masking off higher bits of a value to fit it
	//	into a CPU register)
	jemul8.generateMask = function ( size /* in bytes */ ) {
		// 4 bytes creates a number that is too large for ECMAScript
		//	(before the -1) ... in FF, the result would be zero,
		//	so we hard-code this particular scenario.
		if ( size < 4 ) {
			return (1 << size * 8) - 1;
		} else {
			return 0xFFFFFFFF;
		}
	};
});
