/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2012 http://ovms.co. All Rights Reserved.
 *	
 *	MODULE: Timer class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("timer", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
	// Internal timers
	//	(could use setTimeout/setInterval,
	//	but these would run unchecked between yields;
	//	this should offer more control)
	function Timer( machine, fn, obj_this, intervalUsecs, isContinuous
				, isActive, name, idx ) {
		this.machine = machine;
		
		this.fn = fn;
		this.obj_this = obj_this; // Scope "this" object for callback function
		this.ticksNextFire;
		this.intervalUsecs = 0;
		this.isActive = isActive;
		this.name = name;
		this.idx = idx;
		this.activate(intervalUsecs, isContinuous);
	}
	Timer.prototype.unregister = function () {
		this.machine.list_tmr[ this.idx ] = null;
	};
	Timer.prototype.activate = function ( intervalUsecs, isContinuous ) {
		// Useconds is not 0, so set & use new period/interval
		if ( intervalUsecs !== 0 ) {
			this.intervalUsecs = intervalUsecs;
		}
		// Calculate & store the next expiry time for this timer
		this.ticksNextFire = new Date().getTime() + this.intervalUsecs / 1000;
		this.isContinuous = isContinuous; // Update flag
		this.isActive = true;
	};
	Timer.prototype.deactivate = function () {
		this.ticksNextFire = 0;
		this.isActive = false;
	};
	
	// Exports
	jemul8.Timer = Timer;
});
