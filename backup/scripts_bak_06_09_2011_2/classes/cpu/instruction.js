/*
 *	jemul8 - JavaScript x86 Emulator
 *	Copyright (c) 2011 The OVMS Free Software Project. All Rights Reserved.
 *	
 *	MODULE: CPU Instruction class support
 */

// Augment jQuery plugin
jQuery.plugin("OVMS", "jemul8", "0.0.1")
.module("cpu/instruction", function ( $ ) { "use strict";
	var jemul8 = this.data("jemul8");
	
	// CPU Instruction ( eg. MOV, CMP ) class constructor
	function Instruction( machine, offset, name
						, sizeAddress, sizeOperand ) {
		/* ==== Guards ==== */
		//jemul8.assert(this && (this instanceof Instruction), "Instruction ctor ::"
		//	+ " error - constructor not called properly");
		/* ==== /Guards ==== */
		
		this.machine = machine;
		
		// Mnemonic / name of Instruction
		this.name = name;
		// Absolute offset address of Instruction 
		this.offset = offset;
		this.operand1 = null;
		this.operand2 = null;
		this.operand3 = null;
		// Length of Instruction in bytes
		this.lenBytes = null;
		
		// Repeat prefix for String Instructions (eg. MOVS, LODS, CMPS, SCAS)
		this.repeat = "";
		
		// Address-size attribute
		this.sizeAddress = sizeAddress;
		// Operand-size attribute
		this.sizeOperand = sizeOperand;
		this.mask_sizeOperand = 0;
		
		// Flag to ensure ModR/M byte is only skipped once
		//	(if several Operands use fields from it, they would otherwise
		//	advance the decoder's pointer more than once)
		this.skippedModRM = false;
		
		// POLYMORPHIC: Load appropriate Execute function for Instruction
		this.execute = machine.cpu.hsh_fn_insnExecute[ name ];
	}
	// Generate a human-readable assembly instruction
	//	(useful for debugging etc.)
	Instruction.prototype.getASMText = function () {
		var textASM = (this.repeat ? this.repeat + " " : "") + this.name;
		
		if ( this.operand1 ) {
			textASM += " " + this.operand1.getASMText();
		}
		if ( this.operand2 ) {
			textASM += ", " + this.operand2.getASMText();
		}
		if ( this.operand3 ) {
			textASM += ", " + this.operand3.getASMText();
		}
		
		return textASM;
	};
	
	// Execute a CPU Instruction
	jemul8.x86CPU.prototype.getInstructions = function () {
		var machine = this.machine, CPU = this
			// Accessor used for all TYPE_READ data operations
			, accessorRead = this.accessorRead;
		
		return {
		// ASCII adjust after Addition
		//		Based on http://siyobik.info/index.php?module=x86&id=1
		//	TODO: how to handle other flags? Intel docs say undefined,
		//	but other sources say should be handled just as for other insns
		"AAA": function () {
			var AL = CPU.AL.get();
			
			if ( ((AL & 0x0F) > 9) || (CPU.AF.get()) ) {
				CPU.AL.set((AL + 6) & 0x0F);
				CPU.AH.set(CPU.AH.get() + 1);
				CPU.CF.set();
				CPU.AF.set();
			} else {
				CPU.AL.set(AL & 0x0F);
				CPU.CF.clear();
				CPU.AF.clear();
			}
		// ASCII adjust AX before Division
		}, "AAD": function () {
			// Val1 will almost always be 0Ah ( 10d ), meaning to adjust for base-10 / decimal.
			var val1 = this.operand1.read()
				, res = CPU.AH.get() * val1 + CPU.AL.get();
			
			CPU.AL.set(res & 0xFF);
			CPU.AH.set(0);
			
			this.setFlags_Op1(val1, res);
		// ASCII adjust after Multiplication
		}, "AAM": function () {
			// Val1 will almost always be 0Ah ( 10d ), meaning to adjust for base-10 / decimal.
			var val1 = this.operand1.read()
				, AL = CPU.AL.get()
				, res = CPU.AH.get() * val1 + AL;
			
			CPU.AH.set((AL / 10) >> 0);
			CPU.AL.set(AL % 10);
			this.setFlags_Op1(val1, res);
		// ASCII adjust AL after Subtraction
		//	TODO: how to handle other flags? Intel docs say undefined,
		//	but other sources say should be handled just as for other insns
		}, "AAS": function () {
			var AL = CPU.AL.get();
			
			if ( ((AL & 0x0F) > 9) || (CPU.AF.get()) ) {
				CPU.AL.set((AL - 6) & 0x0F);
				CPU.AH.set(CPU.AH.get() - 1);
				CPU.CF.set();
				CPU.AF.set();
			} else {
				CPU.AL.set(AL & 0x0F);
				CPU.CF.clear();
				CPU.AF.clear();
			}
		// Add with Carry
		}, "ADC": function () {
			var val1 = this.operand1.signExtend()
				, val2 = this.operand2.signExtend()
			// Mask, because add operation can generate too-large numbers
				, res = (val1 + val2 + CPU.CF.get()) & this.mask_sizeOperand;
			
			this.operand1.write(res);
			
			this.setFlags(val1, val2, res);
		// Arithmetic Addition
		}, "ADD": function () {
			var val1 = this.operand1.signExtend()
				, val2 = this.operand2.signExtend()
			// Mask, because add operation can generate too-large numbers
				, res = (val1 + val2) & this.mask_sizeOperand;
			
			this.operand1.write(res);
			
			this.setFlags(val1, val2, res);
		// Logical AND
		}, "AND": function () {
			var val1 = this.operand1.read()
				, val2 = this.operand2.read()
				, res = val1 & val2;
			
			this.operand1.write(res);
			
			this.setFlags(val1, val2, res);
		// Adjusted Requested Privilege Level of Selector ( 286+ Protected Mode )
		}, "ARPL": function () {
			jemul8.problem("Execute (ARPL) :: No Protected Mode support yet.");
			return;
			
			var RPL_Source = this.operand2.getRPL();
			
			if ( this.operand1.getRPL() < RPL_Source ) {
				CPU.ZF.set();
				this.operand1.setRPL(RPL_Source);
			} else {
				CPU.ZF.clear();
			}
		// Array Index Bound Check ( 80188+ )
		//	Based on http://siyobik.info/index.php?module=x86&id=18
		}, "BOUND": function () {
			jemul8.problem("Execute (BOUND) :: No Array bounds support yet.");
		// Bit Scan Forward ( 386+ )
		//	TODO: how to handle other flags? Intel docs say undefined,
		//	but other sources say should be handled just as for other insns
		}, "BSF": function () {
			var sizeBits = this.sizeOperand * 8;
			var val = this.operand2.read();
			
			// Find Least Significant Bit set
			for ( var idx_bit = 0 ; idx_bit < sizeBits ; ++idx_bit ) {
				// Found a set bit
				if ( (val >> idx_bit) & 0x01 ) {
					this.operand1.write(idx_bit);	//this.operand1.reg.set(idx_bit);
					CPU.ZF.clear();
					return;
				}
			}
			// At this point, dest operand's value is undefined ( no set bit found ),
			//	so we will use zero ( and flag explicitly with Zero Flag )
			this.operand1.write(0x00);	//this.operand1.reg.set(0x00);
			CPU.ZF.set();
		// Bit Scan Reverse ( 386+ )
		}, "BSR": function () {
			var sizeBits = this.sizeOperand * 8;
			var val = this.operand2.read();
			
			// Find Most Significant Bit set
			for ( var idx_bit = sizeBits - 1 ; idx_bit >= 0 ; --idx_bit ) {
				// Found a set bit
				if ( (val >> idx_bit) & 0x01 ) {
					this.operand1.write(idx_bit);	//this.operand1.reg.set(idx_bit);
					CPU.ZF.clear();
					return;
				}
			}
			// At this point, dest operand's value is undefined ( no set bit found ),
			//	so we will use zero ( and flag explicitly with Zero Flag )
			this.operand1.write(0x00);	//this.operand1.reg.set(0x00);
			CPU.ZF.set();
		// Byte Swap (486+)
		//	- Reverses the byte order of a 32-bit register.
		}, "BSWAP": function () {
			var val = this.operand1.read();
			
			// Bits 0 through 7 are swapped with bits 24 through 31,
			//	and bits 8 through 15 are swapped with bits 16 through 23.
			this.operand1.write(
					((val & 0xFF000000) >> 24)
					| ((val & 0xFF0000) >> 8)
					| ((val & 0xFF00) << 8)
					| ((val & 0xFF) << 24)
				);
		// Bit Test ( 386+ )
		}, "BT": function () {
			// Read bit at specified offset & store in Carry Flag
			CPU.CF.setBit((this.operand1.read()
				>> this.operand2.read()) & 0x01);
		// Bit Test and Compliment ( 386+ )
		}, "BTC": function () {
			var offsetBit = this.operand2.read();
			var val = this.operand1.read();
			
			// Read bit at specified offset & store in Carry Flag
			CPU.CF.setBit((val >> offsetBit) & 0x01);
			// Complement / toggle the bit just read
			this.operand1.write(val ^ (1 << offsetBit));
		// Bit Test and Reset ( 386+ )
		}, "BTR": function () {
			var offsetBit = this.operand2.read();
			var val = this.operand1.read();
			
			// Read bit at specified offset & store in Carry Flag
			CPU.CF.setBit((val >> offsetBit) & 0x01);
			// Clear / reset the bit just read
			this.operand1.write(val & ~(1 << offsetBit));
		// Bit Test and Set ( 386+ )
		}, "BTS": function () {
			var offsetBit = this.operand2.read();
			var val = this.operand1.read();
			
			// Read bit at specified offset & store in Carry Flag
			CPU.CF.setBit((val >> offsetBit) & 0x01);
			// Set the bit just read
			this.operand1.write(val | (1 << offsetBit));
		// Procedure Call - Near, relative, displacement is relative to next instruction ( adding to EIP )
		//	( within current code segment / intrasegment call )
		}, "CALLN_R": function () {
			var sizeOperand = this.sizeOperand;
			var EIP = CPU.EIP.get();
			
			// General Protection fault / exception if InstructionPointer goes out of bounds for the current Code Segment
			//if ( !this.inCodeSegmentLimits(EIP) ) { CPUException("GP", 0); return; }
			// 16-bit
			if ( this.sizeOperand <= 2 ) {
				// Stack overflow error if no stack space ( 2 bytes / 16-bit )
				//if ( this.getStackSpace() < 2 ) { CPUException("SS", 0); return; }
				// Push only IP ( save another get by just masking out high word )
				CPU.pushStack(EIP & 0x0000FFFF, 2);
				// Destination is rel16
				CPU.EIP.set((EIP + this.operand1.read()) & 0x0000FFFF);
			// 32-bit
			} else {debugger;
				// Stack overflow error if no stack space ( 4 bytes / 32-bit )
				//if ( this.getStackSpace() < 4 ) { CPUException("SS", 0); return; }
				// Push full 32-bit wide EIP
				CPU.pushStack(EIP, 4);
				// Destination is rel32
				CPU.EIP.set(EIP + this.operand1.read());
			}
		// Procedure Call - Near, absolute indirect ( indirect means value is not encoded in insn - read from reg or mem )
		//	( within current code segment / intrasegment call )
		}, "CALLN_AI": function () {
			var sizeOperand = this.sizeOperand;
			var EIP = CPU.EIP.get();
			
			// General Protection fault / exception if InstructionPointer goes out of bounds for the current Code Segment
			//if ( !this.inCodeSegmentLimits(EIP) ) { CPUException("GP", 0); return; }
			// 16-bit
			if ( sizeOperand <= 2 ) {
				// Stack overflow error if no stack space ( 2 bytes / 16-bit )
				//if ( this.getStackSpace() < 2 ) { CPUException("SS", 0); return; }
				// Push only IP ( save another get by just masking out high word )
				CPU.pushStack(EIP & 0xFFFF, 2);
				// Destination is r/m16
				CPU.EIP.set(this.operand1.read() & 0xFFFF);
			// 32-bit
			} else {
				// Stack overflow error if no stack space ( 4 bytes / 32-bit )
				//if ( this.getStackSpace() < 4 ) { CPUException("SS", 0); return; }
				// Push full 32-bit wide EIP
				CPU.pushStack(EIP, 4);
				// Destination is r/m32
				CPU.EIP.set(this.operand1.read());
			}
		// Procedure Call - Far, absolute, address given in operand
		//	( other code segment / intersegment call )
		}, "CALLF_A": function () {
			var EIP = CPU.EIP.get();
			
			// General Protection fault / exception if InstructionPointer goes out of bounds for the current Code Segment
			//if ( !this.inCodeSegmentLimits(EIP) ) { CPUException("GP", 0); return; }
			// Real or Virtual-8086 mode ( PE is the Protection Enable bit in CR0, VM is the EFLAGS's Virtual-8086 enable flag )
			//if ( !CPU.PE.get() || (CPU.PE.get() && CPU.VM.get()) ) {
				// 32-bit
				if ( this.sizeOperand <= 4 ) {
					// Stack overflow error if no stack space ( 4 bytes / 16-bit CS + 16-bit IP )
					//if ( this.getStackSpace() < 4 ) { CPUException("SS", 0); return; }
					// Push CS
					CPU.pushStack(CPU.CS.get() & 0xFFFF, 2);
					// Push only IP ( save another get by just masking out high word )
					CPU.pushStack(EIP & 0xFFFF, 2);
					// Destination is ptr16:16 or [m16:16]
					var dest = this.operand1.read();
					CPU.CS.set(dest >> 16);
					CPU.EIP.set(dest & 0xFFFF);
				// 48-bit
				} else {
					debugger;
					/** We must not use numbers > 32-bit, so we will need
						to read this from memory in two lots, 1 for the 16-bit
						CS val & 1 for the 32-bit EIP val **/
					// Stack overflow error if no stack space ( 6 bytes / 16-bit CS + 32-bit EIP )
					//if ( this.getStackSpace() < 6 ) { CPUException("SS", 0); return; }
					// Push CS
					CPU.pushStack(CPU.CS.get() & 0xFFFF, 2);
					// Push full 32-bit wide EIP
					CPU.pushStack(EIP, 4);
					// Destination is ptr16:32 or [m16:32]
					var dest = this.operand1.read();
					CPU.CS.set(dest >> 32);
					CPU.EIP.set(dest & 0xFFFFFFFF);
				}
			//}
		// Procedure Call - Far, absolute indirect
		//	(indirect means value is not encoded in insn - read from reg or mem)
		//	AKA an "intersegment" call
		}, "CALLF_AI": function () {
			var EIP = CPU.EIP.get();
			//alert(EIP.toString(16));
			// 32-bit
			if ( this.sizeOperand <= 4 ) {
				// Push CS
				CPU.pushStack(CPU.CS.get(), 2);
				// Push only IP ( save another get by just masking out high word )
				CPU.pushStack(EIP & 0xFFFF, 2);
				// Destination is ptr16:16 or [m16:16]
				var dest = this.operand1.read();
				CPU.CS.set(dest >> 16);
				CPU.EIP.set(dest & 0xFFFF);
			// 48-bit
			} else {
				debugger;
				/** We must not use numbers > 32-bit, so we will need
					to read this from memory in two lots, 1 for the 16-bit
					CS val & 1 for the 32-bit EIP val **/
				// Push CS
				CPU.pushStack(CPU.CS.get(), 4); // (Pad with 16 high-order bits)
				// Push full 32-bit wide EIP
				CPU.pushStack(EIP, 4);
				// Destination is ptr16:32 or [m16:32]
				var dest = this.operand1.read();
				CPU.CS.set(dest >> 32);
				CPU.EIP.set(dest);
			}
		// Convert Byte to Word, or Convert Word to Double in EAX
		}, "CBW": function () {
			var AX;
			
			// Sign-extend AL into AH
			if ( this.sizeOperand <= 2 ) {
				CPU.AH.set((CPU.AL.get() >> 7) ? 0xFF : 0x00);
			// Sign-extend AX into high word of EAX
			} else {
				AX = CPU.AX.get();
				CPU.EAX.set(((AX >> 15) ? 0xFFFF0000 : 0x00) | AX);
			}
		// Convert Double to Quad ( 386+ )
		}, "CDQ": function () {
			jemul8.problem("Execute (CDQ) :: unsupported");
		// Clear Carry flag
		}, "CLC": function () {
			CPU.CF.clear();
		// Clear Direction flag
		}, "CLD": function () {
			CPU.DF.clear();
		// Clear Interrupt flag - disables the maskable hardware interrupts. NMI's and software interrupts are not inhibited.
		}, "CLI": function () {
			//	TODO: support VIF ( Virtual Interrupt Flag ( V86 mode ) )
			CPU.IF.clear();
		// Clear Task Switched flag ( 286+ privileged )
		}, "CLTS": function () {
			// Current Privilege Level must be zero in Protected Mode
			if ( CPU.PE.get() && CPU.CPL.get() > 0 ) { CPUException("GP", 0); }
			// Task-Switched flag cleared in CR0
			CPU.TS.clear();
		// Complement/toggle/invert Carry flag
		}, "CMC": function () {
			CPU.CF.toggle();
		// Compare (subtracts two operands, only modifies flags, discards result)
		//	TODO:	- probably has no reason to use lazy flags, as it will always be followed
		//			by a conditional jump. ( ie. should call CPU.ZF.set() etc. )
		}, "CMP": function () {
			var val1 = this.operand1.signExtend()
				, val2 = this.operand2.signExtend()
				, res = (val1 - val2) & this.mask_sizeOperand;
			
			// Do not store result of subtraction; only flags
			this.setFlags(val1, val2, res);
		// Compare String (Byte, Word or Dword)
		//	TODO:	- could be polymorphic, one func for each string-repeat type
		//			- probably has no reason to use lazy flags, as it will always be followed
		//				by a conditional jump. (ie. should call CPU.ZF.set() etc.)
		}, "CMPS": function () {
			var sizeOperand = this.sizeOperand;
			var val1 = 0;
			var val2 = 0;
			var res = 0;
			var esi;
			var edi;
			var esiEnd;
			var len;
			
			switch ( this.repeat ) {
			// Common case; no repeat prefix
			case "":
				val1 = this.operand1.signExtend();
				val2 = this.operand2.signExtend();
				res = (val1 - val2) & this.mask_sizeOperand;
				
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					CPU.ESI.set(
						(CPU.ESI.get() - sizeOperand)
					);
					CPU.EDI.set(
						(CPU.EDI.get() - sizeOperand)
					);
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					CPU.ESI.set(
						(CPU.ESI.get() + sizeOperand)
					);
					CPU.EDI.set(
						(CPU.EDI.get() + sizeOperand)
					);
				}
				// Do not store result of subtraction; only flags
				this.setFlags(val1, val2, res);
				break;
			// Repeat CX times
			case "#REP": // Deliberate fall-thru; see below
				jemul8.problem("Instruction.execute() :: CMPS - #REP invalid");
			// Repeat while Equal, max CX times
			case "#REPE": // For CMPS, it would make little sense to use REP CMPS ( ... ),
						  //	as it would only compare the last 2 characters, so these are tied together
				len = CPU.CX.get() + 1;	// Add 1 to allow more efficient pre-decrement ( see below )
				esi = CPU.ESI.get();
				edi = CPU.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					// Loop CX times ( may exit early if NOT equal, see below )
					while ( --len ) {
						val1 = this.operand1.signExtend();
						val2 = this.operand2.signExtend();
						
						CPU.ESI.set(
							esi = (esi - sizeOperand)
						);
						CPU.EDI.set(
							edi = (edi - sizeOperand)
						);
						
						// Stop checking if NOT equal
						if ( val1 !== val2 ) { break; }
					}
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					// Loop CX times ( may exit early if NOT equal, see below )
					while ( --len ) {
						val1 = this.operand1.signExtend();
						val2 = this.operand2.signExtend();
						
						CPU.ESI.set(
							esi = (esi + sizeOperand)
						);
						CPU.EDI.set(
							edi = (edi + sizeOperand)
						);
						
						// Stop checking if NOT equal
						if ( val1 !== val2 ) { break; }
					}
				}
				// Do not store result of subtraction; only flags
				//	NB: it is worth noting that subtraction actually only has to take place here,
				//		after the tight ( hopefully efficient ) loop above
				this.setFlags(val1, val2, (val1 - val2) & this.mask_sizeOperand);
				CPU.CX.set(len);
				break;
			// Repeat while NOT Equal, max CX times
			case "#REPNE":
				len = CPU.CX.get() + 1;	// Add 1 to allow more efficient pre-decrement ( see below )
				esi = CPU.ESI.get();
				edi = CPU.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					// Loop CX times ( may exit early if not equal, see below )
					while ( --len ) {
						val1 = this.operand1.read();
						val2 = this.operand2.read();
						
						CPU.ESI.set(
							esi = (esi - sizeOperand)
						);
						CPU.EDI.set(
							edi = (edi - sizeOperand)
						);
						
						// Stop checking if equal
						if ( val1 === val2 ) { break; }
					}
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					// Loop CX times ( may exit early if not equal, see below )
					while ( --len ) {
						val1 = this.operand1.read();
						val2 = this.operand2.read();
						
						CPU.ESI.set(
							esi = (esi + sizeOperand)
						);
						CPU.EDI.set(
							edi = (edi + sizeOperand)
						);
						
						// Stop checking if equal
						if ( val1 === val2 ) { break; }
					}
				}
				// Do not store result of subtraction; only flags
				//	NB: it is worth noting that subtraction actually only
				//	has to take place here, after the tight
				//	(hopefully efficient) loop above
				this.setFlags(val1, val2, (val1 - val2)
					& this.mask_sizeOperand);
				CPU.CX.set(len);
				break;
			default:
				jemul8.problem("Execute (CMPS) :: invalid string repeat operation/prefix.");
			}
		// Compare and Exchange (486+)
		}, "CMPXCHG": function () {
			var reg_acc = CPU.accumulator[ this.sizeOperand ]
				, val_acc = reg_acc.get()
				, val1 = this.operand1.signExtend()
				, val2 // Only needed for 1 of the conditions
				, res = (val_acc - val1) & this.mask_sizeOperand;
			
			// NB: the Intel specs say just copy src -> dest or dest -> src;
			//	however, an XCHG would do an actual swap, so this may be incorrect
			if ( res === 0 ) {
				val2 = this.operand2.signExtend();
				this.operand1.write(val2); // Write src -> dest
			} else {
				reg_acc.set(val1); // Write dest -> accumulator
			}
			// Do not store result of subtraction; only flags
			this.setFlags(val_acc, val1, res);
		// Compare and Exchange 8 bytes (Pentium+)
		}, "CMPXCHG8": function () {
			var val1 = this.operand1.signExtend();
			var val2 = (CPU.EDX.get() << 32) | CPU.EAX.get();
			var res = (val1 - val2) & this.mask_sizeOperand;
			
			// NB: the Intel specs say just copy src -> dest or dest -> src;
			//	however, an XCHG would do an actual swap, so this may be incorrect
			if ( res === 0 ) {
				// WARN! use of ECX:EBX here, _NOT_ the tested EDX:EAX!
				this.operand1.write((CPU.ECX.get() << 32) | CPU.EBX.get());
			} else {
				CPU.EAX.set(val1 & 0xFFFFFFFF);
				CPU.EDX.set(val1 >> 32);
			}
			// Do not store result of subtraction; only flags
			this.setFlags(val1, val2, res);
		// Convert Word to Dword, or Dword to Quadword
		}, "CWD": function () {
			// Sign-extend AX into DX:AX
			if ( this.sizeOperand <= 2 ) {
				CPU.DX.set((CPU.AX.get() >> 15) ? 0xFFFF : 0x0000);
			// Sign-extend EAX into EDX
			} else {
				CPU.EDX.set(((CPU.EAX.get() >> 31) ? 0xFFFFFFFF : 0x00000000));
			}
		// Convert Word to Extended Dword ( 386+ )
		}, "CWDE": function () {
			jemul8.problem("Execute (CWDE) :: unsupported");
		// Decimal Adjust after Addition
		}, "DAA": function () {
			jemul8.problem("Execute (DAA) :: unsupported");
		// Decimal Adjust for Subtraction
		}, "DAS": function () {
			debugger;
			jemul8.problem("Execute (DAS) :: unsupported");
		// Decrement
		}, "DEC": function () {
			// NB: Addition and subtraction handle two's complement the same way
			//	for both unsigned and signed interpretations of numbers
			var val = (this.operand1.read() - 1) & this.mask_sizeOperand;
			
			this.operand1.write(val);
			
			this.setFlags_Result(val);
		// Unsigned Divide
		}, "DIV": function () {
			var sizeOperand = this.sizeOperand
			// NB: Default is to interpret as UNsigned
				, dividend = this.operand1.read()
				, divisor = this.operand2.read()
				, res;
			
			// Divide by Zero - CPU Interrupt
			if ( /*dividend == 0 || */divisor == 0 ) { CPU.interrupt(0); return; }
			// Integer result - truncated toward zero
			res = (dividend / divisor) >> 0;
			// Dividend is AX
			if ( sizeOperand == 1 ) {
				// Integer result is written to quotient
				CPU.AL.set(res);
				// Remainder
				CPU.AH.set(dividend % divisor);
			// Dividend is DX:AX
			} else if ( sizeOperand == 2 ) {
				// Integer result is written to quotient
				CPU.AX.set(res);
				// Remainder
				CPU.DX.set(dividend % divisor);
			// Dividend is EDX:EAX
			} else if ( sizeOperand == 4 ) {
				// Integer result is written to quotient
				CPU.EAX.set(res);
				// Remainder
				CPU.EDX.set(dividend % divisor);
			}
			
			this.setFlags(dividend, divisor, res);
		// Make Stack Frame ( 80188+ )
		}, "ENTER": function () {debugger;
			var sizeOperand = this.sizeOperand;
			var bytesStack = this.operand1.read();
			var levelLexicalNesting = this.operand2.read() % 32;
			var EBP = CPU.EBP.get();
			var ESP;
			
			
			if ( sizeOperand <= 2 ) {
				CPU.pushStack(EBP & 0xFF, 1);
			} else {
				CPU.pushStack(EBP, 2);
			}
			// Save Frame pointer
			//	( NB: this is done after the push() above, as SP would be modified )
			ESP = CPU.ESP.get();
			
			if ( levelLexicalNesting > 0 ) {
				for ( var i = 1 ; i < levelLexicalNesting ; ++i ) {
					if ( sizeOperand <= 2 ) {
						CPU.EBP.set(EBP = EBP - 2);
						CPU.pushStack(EBP & 0xFF, 1);
					} else {
						CPU.EBP.set(EBP = EBP - 4);
						CPU.pushStack(EBP, 2);
					}
				}
				CPU.pushStack(ESP, 2);
			}
			// Set Frame pointer to current Stack pointer
			CPU.EBP.set(ESP);
			// Subtract num bytes allocated from Stack pointer
			//	( NB: ESP re-read for here, push()s above will have changed it )
			CPU.ESP.set(CPU.ESP.get() - bytesStack);
		// Escape
		}, "ESC": function () {
			jemul8.problem("Execute (ESC) :: unsupported");
		// Halt CPU
		//	( Or jemul8 Hypervisor escape - see notes below )
		}, "HLT": function () {
			/* ========= Hypervisor escape ========= */
			/*
			 *	This command has been "overloaded" to facilitate the high-level
			 *	emulation of BIOS interrupts; the entries in the IDT MUST point
			 *	to valid code Instruction addresses, because real-mode programs
			 *	are free to "hook" Interrupts by reading the current Int CS:IP, storing
			 *	it in their own memory, replacing the entry with the address of their
			 *	own handler and calling the previous handler at the end of their own.
			 *	HLT is used as it is a reasonably rare Instruction, so the extra overhead
			 *	of handling Hypervisor escaping should not cause a problem.
			 
			var func_interruptHandler;
			// Look up this Instruction's address in the list of Hypervisor calls
			//	to internal Interrupt handlers
			if ( func_interruptHandler = CPU.arr_mapAbsoluteOffset_ToHLEInterruptHandler[this.offset] ) {
				// Quickly dispatch to internal Interrupt handler
				func_interruptHandler.call(CPU);
				return;
			}*/
			/* ========= /Hypervisor escape ========= */
			/**** If we reached this point, it was just a normal HLT command ****/
			alert("cpu halted");
			CPU.halt();
		// Signed Integer Division
		}, "IDIV": function () {
			var sizeOperand = this.sizeOperand;
			// NB: Interpret as signed
			var dividend = this.operand1.signExtend();
			var divisor = this.operand2.signExtend();
			var res;
			
			// Divide by Zero - CPU Interrupt
			if ( divisor == 0 ) { CPU.interrupt(0); return; }
			// Integer result - truncated toward zero
			res = (dividend / divisor) >> 0;
			// Dividend is AX
			if ( sizeOperand == 1 ) {
				// Integer result is written to quotient
				CPU.AL.set(res);
				// Remainder
				CPU.AH.set(dividend % divisor);
			// Dividend is DX:AX
			} else if ( sizeOperand == 2 ) {
				// Integer result is written to quotient
				CPU.AX.set(res);
				// Remainder
				CPU.DX.set(dividend % divisor);
			// Dividend is EDX:EAX
			} else if ( sizeOperand == 4 ) {
				// Integer result is written to quotient
				CPU.EAX.set(res);
				// Remainder
				CPU.EDX.set(dividend % divisor);
			}
			
			this.setFlags(dividend, divisor, res);
		// Signed Multiply
		//	WARNING!!!!!!!!!!!!!!! there are other forms of this instruction
		//	that do not use these implicit accum. operands
		//	!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
		}, "IMUL": function () {
			var sizeOperand = this.sizeOperand;
			// NB: Interpret as signed
			var multiplicand = this.operand1.signExtend();
			var multiplier = this.operand2.signExtend();
			var res;
			
			// Integer result - ( integer inputs guarantees integer result, 
			//	no need for truncating )
			res = multiplicand * multiplier;
			// Dividend is AX
			if ( sizeOperand == 1 ) {
				// Integer result is written to AX
				CPU.AX.set(res);
			// Dividend is DX:AX
			} else if ( sizeOperand == 2 ) {
				// Integer result is written to DX:AX
				CPU.DX.set((res & 0xFFFF0000) >> 16);
				CPU.AX.set(res & 0x0000FFFF);
			// Dividend is EDX:EAX
			} else if ( sizeOperand == 4 ) {
				// Integer result is written to EDX:EAX
				CPU.EDX.set((res & 0xFFFFFFFF00000000) >> 16);
				CPU.EAX.set(res & 0x00000000FFFFFFFF);
			}
			
			this.setFlags(multiplicand, multiplier, res);
		// Input Byte or Word from Port
		}, "IN": function () {
			this.operand1.write(machine.io.read(
				this.operand2.read()	// Port
				, this.operand1.length)	// IO length
			);
		// Increment
		}, "INC": function () {
			// NB: Addition and subtraction handle two's complement the same way
			//	for both unsigned and signed interpretations of numbers
			var val = (this.operand1.read() + 1) & this.mask_sizeOperand;
			
			this.operand1.write(val);
			
			this.setFlags_Result(val);
		// Input String from Port ( 80188+ )
		}, "INS": function () {
			jemul8.problem("Execute (INS) :: Not implemented yet");
		// Software-generated interrupt
		}, "INT": function () {
			if ( this.sizeOperand > 2 ) { debugger; }
			CPU.interrupt(this.operand1.read());
		// Interrupt 4 on Overflow
		}, "INTO": function () {
			// Interrupt number is implicitly 4 (Overflow Exception #OF),
			//	and only called if Overflow Flag set
			if ( CPU.OF.get() ) {
				CPU.interrupt(4);
			}
		// Invalidate Cache ( 486+ )
		}, "INVD": function () {
			jemul8.problem("Execute (INVD) :: unsupported");
		// Invalidate Translation Look-Aside Buffer Entry ( 486+ )
		}, "INVLPG": function () {
			jemul8.problem("Execute (INVLPG) :: unsupported");
		// Perform a far return after Interrupt handling
		//	NB: not used by internal Hypervisor Interrupt Service Routines, for speed
		//	as (E)FLAGS register never needs to be restored after their exec ( it is unaffected )
		//	Based on http://pdos.csail.mit.edu/6.828/2005/readings/i386/IRET.htm
		}, "IRET": function () {
			var eflags;
			if ( this.sizeOperand <= 2 ) {
				// Set all of EIP to zero-out high word
				CPU.EIP.set(CPU.popStack(2));
				CPU.CS.set(CPU.popStack(2));	// 16-bit pop
				// Don't clear high EFLAGS word (is this right??)
				CPU.FLAGS.set(CPU.popStack(2));
			} else {debugger;
				CPU.EIP.set(CPU.popStack(4));
				// Yes, we must pop 32 bits but discard high word
				CPU.CS.set(CPU.popStack(4));
				eflags = CPU.popStack(4);
				CPU.EFLAGS.set((eflags & 0x257FD5)
					| (CPU.EFLAGS.get() & 0x1A0000));
			}
		/* ======= Conditional Jump Instructions ======= */
		/*
		 *	Many of these conditions may be interpreted in one of
		 *	several ways; the mnemonics used here are the first
		 *	in the list provided in the Intel Instruction Formats & Encodings,
		 *	Table B-8.
		 *	( eg. JE (Jump if Equal) is identical to JZ (Jump if Zero),
		 *	as both will jump if the Zero Flag (ZF) is set. )
		 */
		// Jump if Overflow
		}, "JO": function () {
			// Quickly skip if condition not met
			//if ( !CPU.OF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = CPU.EIP.get() + this.operand1.signExtend();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//CPU.EIP.set(EIPNew);
			
			if ( CPU.OF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if NO Overflow
		}, "JNO": function () {
			// Quickly skip if condition not met
			//if ( CPU.OF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = CPU.EIP.get() + this.operand1.signExtend();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//CPU.EIP.set(EIPNew);
			
			if ( !CPU.OF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if Below
		}, "JB": function () {
			// Quickly skip if condition not met
			//if ( !CPU.CF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = CPU.EIP.get() + this.operand1.signExtend();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//CPU.EIP.set(EIPNew);
			
			if ( CPU.CF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if NOT Below
		}, "JNB": function () {
			// Quickly skip if condition not met
			//if ( CPU.CF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = CPU.EIP.get() + this.operand1.signExtend();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//CPU.EIP.set(EIPNew);
			
			if ( !CPU.CF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if Equal
		}, "JE": function () {
			// Quickly skip if condition not met
			//if ( !CPU.ZF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = CPU.EIP.get() + this.operand1.signExtend();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//CPU.EIP.set(EIPNew);
			
			if ( CPU.ZF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if NOT Equal
		}, "JNE": function () {
			// Quickly skip if condition not met
			//if ( CPU.ZF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = CPU.EIP.get() + this.operand1.signExtend();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//CPU.EIP.set(EIPNew);
			
			if ( !CPU.ZF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if Below or Equal
		}, "JBE": function () {
			// Quickly skip if condition not met
			//if ( !CPU.CF.get() && !CPU.ZF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = CPU.EIP.get() + this.operand1.signExtend();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//CPU.EIP.set(EIPNew);
			
			if ( CPU.ZF.get() || CPU.CF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if NOT Below or Equal
		}, "JNBE": function () {
			// Quickly skip if condition not met
			//if ( CPU.CF.get() && CPU.ZF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = CPU.EIP.get() + this.operand1.signExtend();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//CPU.EIP.set(EIPNew);
			
			if ( !CPU.ZF.get() && !CPU.CF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if Sign
		}, "JS": function () {
			// Quickly skip if condition not met
			//if ( !CPU.SF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = CPU.EIP.get() + this.operand1.signExtend();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//CPU.EIP.set(EIPNew);
			
			if ( CPU.SF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if NOT Sign
		}, "JNS": function () {
			// Quickly skip if condition not met
			//if ( CPU.SF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = CPU.EIP.get() + this.operand1.signExtend();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//CPU.EIP.set(EIPNew);
			
			if ( !CPU.SF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if Parity / Parity Even
		}, "JP": function () {
			// Quickly skip if condition not met
			//if ( !CPU.PF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = CPU.EIP.get() + this.operand1.signExtend();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//CPU.EIP.set(EIPNew);
			
			if ( CPU.PF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if NOT Parity / Parity Even
		}, "JNP": function () {
			// Quickly skip if condition not met
			//if ( CPU.PF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = CPU.EIP.get() + this.operand1.signExtend();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//CPU.EIP.set(EIPNew);
			
			if ( !CPU.PF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if Less Than
		}, "JL": function () {
			// Quickly skip if condition not met
			//if ( CPU.ZF.get() || (CPU.SF.get() === CPU.OF.get()) ) { return; }
			// NB: Interpret as signed
			//var EIPNew = CPU.EIP.get() + this.operand1.signExtend();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//CPU.EIP.set(EIPNew);
			
			if ( /*!CPU.ZF.get() && */(CPU.SF.get() !== CPU.OF.get()) ) {
				jumpShortOrNear(this);
			}
		// Jump if NOT Less Than
		}, "JNL": function () {
			// Quickly skip if condition not met
			//if ( CPU.SF.get() !== CPU.OF.get() ) { return; }
			// NB: Interpret as signed
			//var EIPNew = CPU.EIP.get() + this.operand1.signExtend();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//CPU.EIP.set(EIPNew);
			
			if ( CPU.SF.get() === CPU.OF.get() ) {
				jumpShortOrNear(this);
			}
		// Jump if Less Than or Equal
		}, "JLE": function () {
			// Quickly skip if condition not met
			//if ( !CPU.ZF.get() && (CPU.SF.get() === CPU.OF.get()) ) { return; }
			// NB: Interpret as signed
			//var EIPNew = CPU.EIP.get() + this.operand1.signExtend();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//CPU.EIP.set(EIPNew);
			
			if ( CPU.ZF.get() || (CPU.SF.get() !== CPU.OF.get()) ) {
				jumpShortOrNear(this);
			}
		// Jump if NOT Less Than or Equal
		}, "JNLE": function () {
			// Quickly skip if condition not met
			//if ( !CPU.ZF.get() && (CPU.SF.get() === CPU.OF.get()) ) { return; }
			// NB: Interpret as signed
			//var EIPNew = CPU.EIP.get() + this.operand1.signExtend();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//CPU.EIP.set(EIPNew);
			if ( !CPU.ZF.get() && (CPU.SF.get() === CPU.OF.get()) ) {
				jumpShortOrNear(this);
			}
		// Jump if Register CX is Zero
		// Jump if Register ECX is Zero ( 386+ )
		//	( NB: this conditional jump has no inverse )
		}, "JCXZ": function () {
			//var EIPNew;
			//var sizeOperand = this.sizeOperand;
			
			// Quickly skip if condition not met
			// JCXZ
			//if ( sizeOperand == 2 ) {
			//	if ( CPU.CX.get() !== 0 ) { return; }
			// JECXZ
			//} else {
			//	if ( CPU.ECX.get() !== 0 ) { return; }
			//}
			
			// NB: Interpret as signed
			//EIPNew = CPU.EIP.get() + this.operand1.signExtend();
			// Wrap 16-bit addresses
			//if ( sizeOperand == 2 ) { EIPNew &= 0x0000FFFF; }
			//CPU.EIP.set(EIPNew);
			
			// Quickly skip if condition not met
			if ( (this.sizeOperand <= 2 ? CPU.CX : CPU.ECX) // Base on op-size
					.get() === 0 ) {
				jumpShortOrNear(this);
			}
		/* ======= /Conditional Jump Instructions ======= */
		
		// Unconditional Jump (Short 8-bit / Near 16-bit)
		//	- relative to next Instruction
		}, "JMPN": function () {
			// NB: Interpret as signed
			//var EIPNew = CPU.EIP.get() + this.operand1.signExtend();
			
			// Wrap 16-bit addresses
			//if ( this.sizeOperand <= 2 ) { EIPNew &= 0x0000FFFF; }
			//CPU.EIP.set(EIPNew);
			
			jumpShortOrNear(this);
		// Unconditional Jump (Far - if indirect then address
		//	is read from memory pointer or register)
		}, "JMPF": function () {//debugger;
			// NB: Do not interpret as signed; cannot have an absolute EIP that is negative
			var CS_EIP = this.operand1.read();
			
			// 32-bit pointer
			if ( this.sizeOperand <= 4 ) {
				CPU.CS.set(CS_EIP >> 16);
				CPU.EIP.set(CS_EIP & 0xFFFF);
			// 48-bit pointer (NOT 64-bit; even though EIP is 32-bit,
			//	CS is still 16-bit)
			} else {
				CPU.CS.set(CS_EIP >> 32);
				CPU.EIP.set(CS_EIP & 0xFFFFFFFF);
			}
		// Load Flags into AH Register
		}, "LAHF": function () {
			// Transfer only the low byte of Flags word to AH
			CPU.AH.set(CPU.FLAGS.get() & 0xFF);
		// Load Access Rights Byte
		}, "LAR": function () {
			jemul8.problem("Execute (LAR) :: unsupported");
		// Load Effective Address
		}, "LEA": function () {
			// Just compute the Memory Address of the 2nd Operand
			//	and store it in the first
			this.operand1.write(
				this.operand2.getPointerAddress() & this.mask_sizeOperand
			);
		// High Level Procedure Exit
		}, "LEAVE": function () {debugger;
			// NB: Reverses the actions of the ENTER instruction. 
			//	By copying the frame pointer to the stack pointer,
			//	LEAVE releases the stack space used by a procedure for its local variables.
			if ( CPU.getStackAddressSize() === 16 ) {
				CPU.SP.set(CPU.BP.get());
			} else {
				CPU.ESP.set(CPU.EBP.get());
			}
			if ( this.sizeOperand <= 2 ) {
				CPU.BP.set(CPU.popStack(2));
			} else {
				CPU.EBP.set(CPU.popStack(4));
			}
		// Load Global Descriptor Table Register
		}, "LGDT": function () {
			jemul8.problem("Execute (LGDT) :: unsupported");
		// Load Interrupt Descriptor Table Register
		}, "LIDT": function () {
			jemul8.problem("Execute (LIDT) :: unsupported");
		// Load Full Pointer with DS
		}, "LDS": function () {
			// 16-bit
			if ( this.sizeOperand <= 2 ) {
				this.operand1.write(this.operand2.read());
				jemul8.panic("LDS :: Not implemented");
				//CPU.DS.set(accessorRead.readBytes(this.operand2.getPointerAddress() + 2, 2));
				// In Protected Mode, load the descriptor into the segment register
			// 32-bit
			} else {
				this.operand1.write(this.operand2.read());
				jemul8.panic("LDS :: Not implemented");
				//CPU.DS.set(accessorRead.readBytes(this.operand2.getPointerAddress() + 4, 2));
				// In Protected Mode, load the descriptor into the segment register
			}
		// Load Full Pointer with ES
		}, "LES": function () {
			// 16-bit
			if ( this.sizeOperand <= 2 ) {
				this.operand1.write(this.operand2.read());
				jemul8.panic("LES :: Not implemented");
				//CPU.ES.set(accessorRead.readBytes(this.operand2.getPointerAddress() + 2, 2));
				// In Protected Mode, load the descriptor into the segment register
			// 32-bit
			} else {
				this.operand1.write(this.operand2.read());
				jemul8.panic("LES :: Not implemented");
				//CPU.ES.set(accessorRead.readBytes(this.operand2.getPointerAddress() + 4, 2));
				// In Protected Mode, load the descriptor into the segment register
			}
		// Load Full Pointer with FS
		}, "LFS": function () {
			// 16-bit
			if ( this.sizeOperand <= 2 ) {
				this.operand1.write(this.operand2.read());
				jemul8.panic("LFS :: Not implemented");
				//CPU.FS.set(accessorRead.readBytes(this.operand2.getPointerAddress() + 2, 2));
				// In Protected Mode, load the descriptor into the segment register
			// 32-bit
			} else {
				this.operand1.write(this.operand2.read());
				jemul8.panic("LFS :: Not implemented");
				//CPU.FS.set(accessorRead.readBytes(this.operand2.getPointerAddress() + 4, 2));
				// In Protected Mode, load the descriptor into the segment register
			}
		// Load Full Pointer with GS
		}, "LGS": function () {
			// 16-bit
			if ( this.sizeOperand <= 2 ) {
				this.operand1.write(this.operand2.read());
				jemul8.panic("LGS :: Not implemented");
				//CPU.GS.set(accessorRead.readBytes(this.operand2.getPointerAddress() + 2, 2));
				// In Protected Mode, load the descriptor into the segment register
			// 32-bit
			} else {
				this.operand1.write(this.operand2.read());
				jemul8.panic("LGS :: Not implemented");
				//CPU.GS.set(accessorRead.readBytes(this.operand2.getPointerAddress() + 4, 2));
				// In Protected Mode, load the descriptor into the segment register
			}
		// Load Full Pointer with SS
		}, "LSS": function () {
			// 16-bit
			if ( this.sizeOperand <= 2 ) {
				this.operand1.write(this.operand2.read());
				jemul8.panic("LSS :: Not implemented");
				//CPU.SS.set(accessorRead.readBytes(this.operand2.getPointerAddress() + 2, 2));
				// In Protected Mode, load the descriptor into the segment register
			// 32-bit
			} else {
				this.operand1.write(this.operand2.read());
				jemul8.panic("LSS :: Not implemented");
				//CPU.SS.set(accessorRead.readBytes(this.operand2.getPointerAddress() + 4, 2));
				// In Protected Mode, load the descriptor into the segment register
			}
		// Load Local Descriptor Table Register
		}, "LLDT": function () {
			jemul8.problem("Execute (LLDT) :: unsupported");
		// Load Machine Status Word
		}, "LMSW": function () {
			jemul8.problem("Execute (LMSW) :: unsupported");
			// CPU.CR0
		// Load String ( Byte, Word or Dword )
		//	TODO: could be polymorphic, one func for each string-repeat type
		//	TODO: there is potential for speed ups here by using native .indexOf() / .slice() and similar
		//		array methods, instead of a possibly slow loop over each individual byte
		}, "LODS": function () {
			var sizeOperand = this.sizeOperand;
			var val1;
			var val2;
			var res;
			var esi;
			var edi;
			var esiEnd;
			var len;
			
			switch ( this.repeat ) {
			// Common case; no repeat prefix
			case "":
				// Load String Character ( Operand 1 is part of Accumulator, Operand 2
				//	will be a memory pointer using (E)SI )
				this.operand1.write(this.operand2.read());
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					CPU.ESI.set(
						(CPU.ESI.get() - sizeOperand)
					);
					CPU.EDI.set(
						(CPU.EDI.get() - sizeOperand)
					);
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					CPU.ESI.set(
						(CPU.ESI.get() + sizeOperand)
					);
					CPU.EDI.set(
						(CPU.EDI.get() + sizeOperand)
					);
				}
				
				break;
			// Repeat CX times
			case "#REP":
				len = CPU.CX.get() * sizeOperand;
				esi = CPU.ESI.get();
				edi = CPU.EDI.get();
				// Direction Flag set, decrement (scan in reverse direction)
				if ( CPU.DF.get() ) {
					esiEnd = esi - len;
					for ( ; esi >= esiEnd
					; esi -= sizeOperand, edi -= sizeOperand ) {
						CPU.ESI.set(esi);
						CPU.EDI.set(edi);
						// Load String Character (Operand 1 is part
						//	of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI)
						this.operand1.write(this.operand2.read());
					}
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					esiEnd = esi + len;
					for ( ; esi < esiEnd
					; esi += sizeOperand, edi += sizeOperand ) {
						CPU.ESI.set(esi);
						CPU.EDI.set(edi);
						// Load String Character (Operand 1 is part
						//	of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI)
						this.operand1.write(this.operand2.read());
					}
				}
				CPU.ESI.set(esi);
				CPU.EDI.set(edi);
				break;
			// Repeat while Equal, max CX times
			case "#REPE":
				len = CPU.CX.get() * sizeOperand;
				esi = CPU.ESI.get();
				edi = CPU.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					esiEnd = esi - len;
					for ( ; esi >= esiEnd
					; esi -= sizeOperand, edi -= sizeOperand ) {
						CPU.ESI.set(esi);
						CPU.EDI.set(edi);
						// Load String Character (Operand 1 is part
						//	of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI)
						this.operand1.write(this.operand2.read());
						// NB: This test cannot be in the for(...) condition
						if ( !CPU.ZF.get() ) { break; }
					}
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					esiEnd = esi + len;
					for ( ; esi < esiEnd
					; esi += sizeOperand, edi += sizeOperand ) {
						CPU.ESI.set(esi);
						CPU.EDI.set(edi);
						// Load String Character (Operand 1 is part
						//	of Accumulator, Operand 2
						//	will be a memory pointer using (E)SI)
						this.operand1.write(this.operand2.read());
						// NB: This test cannot be in the for(...) condition
						if ( !CPU.ZF.get() ) { break; }
					}
				}
				CPU.ESI.set(esi);
				CPU.EDI.set(edi);
				break;
			// Repeat while Not Equal, max CX times
			case "#REPNE":
				len = CPU.CX.get();
				esi = CPU.ESI.get();
				edi = CPU.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					esiEnd = esi - len * sizeOperand;
					for ( ; esi >= esiEnd
					; esi -= sizeOperand, edi -= sizeOperand ) {
						CPU.ESI.set(esi);
						CPU.EDI.set(edi);
						// Load String Character
						//	- Operand 1 is part of Accumulator
						//	- Operand 2 will be a memory pointer using (E)SI
						this.operand1.write(this.operand2.read());
						// NB: This test cannot be in the for(...) condition
						if ( CPU.ZF.get() ) { break; }
					}
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					esiEnd = esi + len * sizeOperand;
					for ( ; esi < esiEnd
					; esi += sizeOperand, edi += sizeOperand ) {
						CPU.ESI.set(esi);
						CPU.EDI.set(edi);
						// Load String Character
						//	- Operand 1 is part of Accumulator,
						//	- Operand 2 will be a memory pointer using (E)SI
						this.operand1.write(this.operand2.read());
						// NB: This test cannot be in the for(...) condition
						if ( CPU.ZF.get() ) { break; }
					}
				}
				CPU.ESI.set(esi);
				CPU.EDI.set(edi);
				break;
			default:
				jemul8.problem("Execute (LODS) ::"
					+ " invalid string repeat operation/prefix.");
			}
		// Loop Control with CX Counter
		}, "LOOP": function () {
			var regCount = (this.sizeAddress === 2) ? CPU.CX : CPU.ECX;
			var count = regCount.get() - 1; // Decrement the counter!
			
			regCount.set(count);
			
			// Loop round by jumping to the address in operand1,
			//	if counter has not yet reached zero
			if ( count !== 0 ) {
				if ( this.sizeOperand < 4 ) {
					// Sign-extend to signed int
					CPU.IP.set(CPU.IP.get() + this.operand1.signExtend(2));
				} else {
					// Sign-extend to signed int
					CPU.EIP.set(CPU.EIP.get() + this.operand1.signExtend(4));
				}
			}
		// Loop Control with CX Counter
		}, "LOOPE": function () {
			var regCount;
			var count;
			
			if ( this.sizeAddress == 2 ) {
				regCount = CPU.CX;
			} else {
				regCount = CPU.ECX;
			}
			// Decrement counter ( & store result in local var to avoid another expensive Get() )
			regCount.set(count = regCount.get() - 1);
			
			if ( count != 0 && CPU.ZF.get() ) {
				if ( this.sizeOperand <= 2 ) {
					// Sign-extend to signed int
					CPU.IP.set(CPU.IP.get() + this.operand1.signExtend());
				} else {
					// Sign-extend to signed int
					CPU.EIP.set(CPU.EIP.get() + this.operand1.signExtend());
				}
			}
		// Loop Control with CX Counter
		}, "LOOPNE": function () {
			var regCount;
			var count;
			
			if ( this.sizeAddress == 2 ) {
				regCount = CPU.CX;
			} else {
				regCount = CPU.ECX;
			}
			// Decrement counter ( & store result in local var to avoid another expensive Get() )
			regCount.set(count = regCount.get() - 1);
			
			if ( count != 0 && !CPU.ZF.get() ) {
				if ( this.sizeOperand <= 2 ) {
					// Sign-extend to signed int
					CPU.IP.set(CPU.IP.get() + this.operand1.signExtend());
				} else {
					// Sign-extend to signed int
					CPU.EIP.set(CPU.EIP.get() + this.operand1.signExtend());
				}
			}
		// Load Segment Limit
		}, "LSL": function () {
			jemul8.problem("Execute (LSL) :: unsupported");
		// Load Task Register
		}, "LTR": function () {
			jemul8.problem("Execute (LTR) :: unsupported");
		// Move ( Copy ) data
		}, "MOV": function () {
			//if ( this.operand2.read() === 0x0417 ) {
			//if ( this.operand1.reg === CPU.SP ) {
			//	debugger;
			//}
			
			this.operand1.write(this.operand2.read() & this.mask_sizeOperand);
		// Move Data from String to String ( Byte, Word or Dword )
		//	TODO: could be polymorphic, one func for each string-repeat type
		//	TODO: there is potential for speed ups here by using native .indexOf() / .slice() and similar
		//		array methods, instead of a possibly slow loop over each individual byte
		}, "MOVS": function () {
			var sizeOperand = this.sizeOperand;
			var val1;
			var val2;
			var res;
			var esi;
			var edi;
			var esiEnd;
			var len;
			
			switch ( this.repeat ) {
			// Common case; no repeat prefix
			case "":
				// Load String Character ( Operand 1 is part of Accumulator, Operand 2
				//	will be a memory pointer using (E)SI )
				this.operand1.write(this.operand2.read());
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					CPU.ESI.set(
						(CPU.ESI.get() - sizeOperand)
					);
					CPU.EDI.set(
						(CPU.EDI.get() - sizeOperand)
					);
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					CPU.ESI.set(
						(CPU.ESI.get() + sizeOperand)
					);
					CPU.EDI.set(
						(CPU.EDI.get() + sizeOperand)
					);
				}
				
				break;
			// Repeat CX times
			case "#REP":
				len = CPU.CX.get() * sizeOperand;
				esi = CPU.ESI.get();
				edi = CPU.EDI.get();
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					esiEnd = esi - len;
					for ( ; esi >= esiEnd
					; esi -= sizeOperand, edi -= sizeOperand ) {
						CPU.ESI.set(esi);
						CPU.EDI.set(edi);
						// Load String Character
						//	- Operand 1 is part of Accumulator
						//	- Operand 2 will be a memory pointer using (E)SI
						this.operand1.write(this.operand2.read());
					}
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					esiEnd = esi + len;
					for ( ; esi < esiEnd
					; esi += sizeOperand, edi += sizeOperand ) {
						// Load String Character
						//	- Operand 1 is part of Accumulator
						//	- Operand 2 will be a memory pointer using (E)SI
						this.operand1.write(this.operand2.read());
						CPU.ESI.set(esi);
						CPU.EDI.set(edi);
					}
				}
				CPU.ESI.set(esi);
				CPU.EDI.set(edi);
				break;
			// Repeat while Equal, max CX times
			case "#REPE":
				len = CPU.CX.get() * sizeOperand;
				esi = CPU.ESI.get();
				edi = CPU.EDI.get();
				// Direction Flag set, decrement (scan in reverse direction)
				if ( CPU.DF.get() ) {
					esiEnd = esi - len;
					for ( ; esi >= esiEnd
					; esi -= sizeOperand, edi -= sizeOperand ) {
						CPU.ESI.set(esi);
						CPU.EDI.set(edi);
						// Load String Character
						//	- Operand 1 is part of Accumulator
						//	- Operand 2 will be a memory pointer using (E)SI
						this.operand1.write(this.operand2.read());
						// NB: This test cannot be in the for(...) condition
						if ( !CPU.ZF.get() ) { break; }
					}
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					esiEnd = esi + len;
					for ( ; esi < esiEnd
					; esi += sizeOperand, edi += sizeOperand ) {
						CPU.ESI.set(esi);
						CPU.EDI.set(edi);
						// Load String Character
						//	- Operand 1 is part of Accumulator
						//	- Operand 2 will be a memory pointer using (E)SI
						this.operand1.write(this.operand2.read());
						// NB: This test cannot be in the for(...) condition
						if ( !CPU.ZF.get() ) { break; }
					}
				}
				CPU.ESI.set(esi);
				CPU.EDI.set(edi);
				break;
			// Repeat while Not Equal, max CX times
			case "#REPNE":
				len = CPU.CX.get();
				esi = CPU.ESI.get();
				edi = CPU.EDI.get();
				// Direction Flag set, decrement (scan in reverse direction)
				if ( CPU.DF.get() ) {
					esiEnd = esi - len * sizeOperand;
					for ( ; esi >= esiEnd
					; esi -= sizeOperand, edi -= sizeOperand ) {
						CPU.ESI.set(esi);
						CPU.EDI.set(edi);
						// Load String Character
						//	- Operand 1 is part of Accumulator
						//	- Operand 2 will be a memory pointer using (E)SI
						this.operand1.write(this.operand2.read());
						// NB: This test cannot be in the for(...) condition
						if ( CPU.ZF.get() ) { break; }
					}
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					esiEnd = esi + len * sizeOperand;
					for ( ; esi < esiEnd
					; esi += sizeOperand, edi += sizeOperand ) {
						CPU.ESI.set(esi);
						CPU.EDI.set(edi);
						// Load String Character
						//	- Operand 1 is part of Accumulator
						//	- Operand 2 will be a memory pointer using (E)SI
						this.operand1.write(this.operand2.read());
						// NB: This test cannot be in the for(...) condition
						if ( CPU.ZF.get() ) { break; }
					}
				}
				CPU.ESI.set(esi);
				CPU.EDI.set(edi);
				break;
			default:
				jemul8.problem("Execute (MOVS) :: invalid string repeat operation/prefix.");
			}
		// Move with Sign Extend
		}, "MOVSX": function () {
			this.operand1.write(this.operand2.signExtend() & this.mask_sizeOperand);
		// Move with Zero Extend
		}, "MOVZX": function () {
			this.operand1.write(this.operand2.read() & this.mask_sizeOperand);
		// UNsigned Multiply
		}, "MUL": function () {
			var sizeOperand = this.sizeOperand
			// NB: Default interpretation is UNsigned
				, multiplicand = this.operand1.read()
				, multiplier = this.operand2.read()
				, res;
			
			// Integer result - ( integer inputs guarantees integer result, 
			//	no need for truncating )
			res = multiplicand * multiplier;
			// Dividend is AX
			if ( sizeOperand == 1 ) {
				// Integer result is written to AX
				CPU.AX.set(res);
			// Dividend is DX:AX
			} else if ( sizeOperand == 2 ) {
				// Integer result is written to DX:AX
				CPU.DX.set(res >> 16);
				CPU.AX.set(res & 0x0000FFFF);
			// Dividend is EDX:EAX
			} else if ( sizeOperand == 4 ) {
				// Integer result is written to EDX:EAX
				CPU.EDX.set(res >> 32);
				CPU.EAX.set(res & 0x00000000FFFFFFFF);
			}
			
			this.setFlags(multiplicand, multiplier, res);
		// Two's Complement negation
		}, "NEG": function () {
			// Note use of negation operator "-"
			this.operand1.write(-this.operand2.signExtend());
		// Do nothing. Occupies both time & space
		}, "NOP": function () {
			// ...
		// One's Complement negation ( Logical NOT )
		}, "NOT": function () {
			// TEMP: There is a NOT in the extensions table
			//	that has no operands... ???? :S ???? AX??
			if ( !this.operand1 ) { debugger; }
			
			// Note use of bitwise inversion operator "~"
			this.operand1.write(~this.operand1.read());
			
			// TODO: setFlags() ... ??
		// Logical OR
		}, "OR": function () {
			var val1 = this.operand1.read()
				, val2 = this.operand2.read()
				, res = val1 | val2;
			
			this.operand1.write(res);
			
			this.setFlags(val1, val2, res);
		// Output to Port
		}, "OUT": function () {
			machine.io.write(
				this.operand1.read()	// Port
				, this.operand2.read()	// Value
				, this.operand2.length	// IO length
			);
		// Output String to Port
		}, "OUTS": function () {
			debugger;
			
			jemul8.problem("Execute (OUTS) :: Not implemented yet");
		// Pop a value from the Stack (SS:SP)
		}, "POP": function () {
			this.operand1.write(CPU.popStack(this.sizeOperand));
		// Pop all General Registers
		}, "POPA": function () {
			// POPA
			if ( this.sizeOperand <= 2 ) {
				CPU.DI.set(CPU.popStack(2));
				CPU.SI.set(CPU.popStack(2));
				CPU.BP.set(CPU.popStack(2));
				CPU.popStack(2);		// Skip SP
				CPU.BX.set(CPU.popStack(2));
				CPU.DX.set(CPU.popStack(2));
				CPU.CX.set(CPU.popStack(2));
				CPU.AX.set(CPU.popStack(2));
			// POPAD
			} else {debugger;
				CPU.EDI.set(CPU.popStack(4));
				CPU.ESI.set(CPU.popStack(4));
				CPU.EBP.set(CPU.popStack(4));
				CPU.popStack(4);		// Skip ESP
				CPU.EBX.set(CPU.popStack(4));
				CPU.EDX.set(CPU.popStack(4));
				CPU.ECX.set(CPU.popStack(4));
				CPU.EAX.set(CPU.popStack(4));
			}
		// Pop Stack into FLAGS / EFLAGS Register
		}, "POPF": function () {
			// NB: bits 16 and 17 ( VM & RF ) should not be affected by this
			//	(TODO: mask... ^!)
			//debugger;
			
			// POPF
			if ( this.sizeOperand <= 2 ) {
				CPU.FLAGS.set(CPU.popStack(2));
			// POPFD
			} else {debugger;
				CPU.EFLAGS.set(CPU.popStack(4));
			}
		// Push data onto stack top ( SS:SP )
		}, "PUSH": function () {
			CPU.pushStack(this.operand1.read(), this.sizeOperand);
		// Push all General Registers
		}, "PUSHA": function () {
			var ptrStack;
			
			// PUSHA
			if ( this.sizeOperand <= 2 ) {
				// Remember to save Stack Pointer, push()es will modify it
				ptrStack = CPU.SP.get();
				CPU.pushStack(CPU.AX.get(), 2);
				CPU.pushStack(CPU.CX.get(), 2);
				CPU.pushStack(CPU.DX.get(), 2);
				CPU.pushStack(CPU.BX.get(), 2);
				CPU.pushStack(ptrStack, 2);
				CPU.pushStack(CPU.BP.get(), 2);
				CPU.pushStack(CPU.SI.get(), 2);
				CPU.pushStack(CPU.DI.get(), 2);
			// PUSHAD
			} else {debugger;
				// Remember to save Stack Pointer, push()es will modify it
				ptrStack = CPU.ESP.get();
				CPU.pushStack(CPU.EAX.get(), 4);
				CPU.pushStack(CPU.ECX.get(), 4);
				CPU.pushStack(CPU.EDX.get(), 4);
				CPU.pushStack(CPU.EBX.get(), 4);
				CPU.pushStack(ptrStack, 4);
				CPU.pushStack(CPU.EBP.get(), 4);
				CPU.pushStack(CPU.ESI.get(), 4);
				CPU.pushStack(CPU.EDI.get(), 4);
			}
		// Push Flags Register onto Stack
		}, "PUSHF": function () {
			//debugger;
			
			// PUSHF
			if ( this.sizeOperand <= 2 ) {
				CPU.pushStack(CPU.FLAGS.get(), 2);
			// PUSHFD
			} else {debugger;
				CPU.pushStack(CPU.EFLAGS.get(), 4);
			}
		// Rotate Bits Left
		}, "ROL": function () {debugger;
			// Fast left-rotation using masks instead of a loop
			var bits = this.operand1.read();
			var numBitsIn = this.sizeOperand * 8;
			// Modulo, because shifting by bit-length of operand ( eg. 16/32 ) is same as shifting by zero
			var numBitsShift = this.operand2.read() % numBitsIn;
			var numBitsRemaining = numBitsIn - numBitsShift;
			var bitsRemaining = (bits & ((1 << numBitsRemaining) - 1)) << numBitsShift;
			var bitsShiftedOut = bits >> numBitsRemaining;
			
			this.operand1.write(bitsRemaining | bitsShiftedOut);
			// Carry Flag is set to LSB of bits shifted out (if this had been a loop,
			//	the last bit shifted off the left and onto the right would be this one)
			CPU.CF.setBin(bitsShiftedOut & 0x01);
		// Rotate Bits Right
		}, "ROR": function () {debugger;
			// Fast right-rotation using masks instead of a loop
			var bits = this.operand1.read();
			var numBitsIn = this.sizeOperand * 8;
			// Modulo, because shifting by bit-length of operand ( eg. 16/32 ) is same as shifting by zero
			//	( NB: was changed to & as 011111b is 31, bitwise-AND should be faster/cheaper than modulo ( in Chrome ),
			//		however after testing modulo % is actually faster ( in TM ) )
			var numBitsShift = this.operand2.read() % numBitsIn;
			var numBitsRemaining = numBitsIn - numBitsShift;
			var bitsRemaining = bits >> numBitsShift;
			var bitsShiftedOut = (bits & ((1 << numBitsShift) - 1)) << numBitsRemaining;
			
			this.operand1.write(bitsRemaining | bitsShiftedOut);
			// Carry Flag is set to MSB of bits shifted out ( if this had been a loop,
			//	the last bit shifted off the right and onto the left would be this one )
			CPU.CF.setBin(bitsShiftedOut & (1 << numBitsShift));
		// Rotate Bits Left with Carry Flag
		}, "RCL": function () {
			jemul8.problem("Execute (RCL) :: unsupported");
		// Rotate Bits Right with Carry Flag
		}, "RCR": function () {
			jemul8.problem("Execute (RCR) :: unsupported");
		// Return ( Near ) from Procedure
		}, "RETN": function () {
			if ( this.sizeOperand <= 2 ) {
				// ( NB: Will clear high word of EIP )
				CPU.EIP.set(CPU.popStack(2));
			} else {debugger;
				CPU.EIP.set(CPU.popStack(4));
			}
			
			//if ( CPU.IP.get() === 0xFFF6 ) { debugger; }
		// Return ( Far ) from Procedure
		}, "RETF": function () {
			// Needs testing!!!!!!!!!
			//debugger;
			
			//var sizeOperand = this.sizeOperand;
			//var PE = CPU.PE.get();
			//var VM = CPU.VM.get();
			
			// Real or Virtual-8086 mode ( PE is the Protection Enable bit in CR0, VM is the EFLAGS's Virtual-8086 enable flag )
			//if ( !PE || (PE && VM) ) {
				// 16-bit
				if ( this.sizeOperand <= 2 ) {
					// (NB: Will clear high word of EIP)
					CPU.EIP.set(CPU.popStack(2));
					// Pop CS
					CPU.CS.set(CPU.popStack(2));
				// 32-bit
				} else {debugger;
					// Pop only IP ( save another get by just masking out high word )
					//	( NB: Will clear high word of EIP )
					CPU.EIP.set(CPU.popStack(4));
					// Pop CS ( 32-bit pop, high-order 16 bits discarded )
					CPU.CS.set(CPU.popStack(4));
				}
			//}
		// Return (Near) from Procedure and pop imm16 bytes of parameters
		}, "RETN_P": function () {debugger;
			if ( this.sizeOperand <= 2 ) {
				// Will clear high word of EIP
				CPU.EIP.set(CPU.popStack(2));
			} else {
				CPU.EIP.set(CPU.popStack(4));
			}
			// Pop (& discard) imm16 bytes of parameters
			CPU.ESP.set(CPU.ESP.get() + this.operand1.read());
		// Return ( Far ) from Procedure and pop imm16 bytes of parameters
		}, "RETF_P": function () {
			// Needs testing!!!!!!!!!
			debugger;
			
			var sizeOperand = this.sizeOperand;
			var PE = CPU.PE.get();
			var VM = CPU.VM.get();
			
			// Real or Virtual-8086 mode ( PE is the Protection Enable bit in CR0, VM is the EFLAGS's Virtual-8086 enable flag )
			//if ( !PE || (PE && VM) ) {
				// 16-bit
				if ( sizeOperand <= 2 ) {
					// Pop only IP ( save another get by just masking out high word )
					//	( NB: Will clear high word of EIP )
					CPU.EIP.set(CPU.popStack(2));
					// Pop CS
					CPU.CS.set(CPU.popStack(2));
				// 32-bit
				} else {
					// Pop only IP ( save another get by just masking out high word )
					//	( NB: Will clear high word of EIP )
					CPU.EIP.set(CPU.popStack(4));
					// Pop CS ( 32-bit pop, high-order 16 bits discarded )
					CPU.CS.set(CPU.popStack(4));
				}
			//}
			// Pop imm16 bytes of parameters
			// ????!??!? WHAT this looks wrong.....
			CPU.ESP.set(CPU.ESP.get() + this.operand1.read());
		// Store AH into Flags
		}, "SAHF": function () {
			// Mask out current values of Flags and replace with contents of AH
			CPU.FLAGS.set((CPU.FLAGS.get() & 0xFF00) | CPU.AH.get());
		// Shift Left / Shift Arithmetic Left
		}, "SHL": function () {
			var bits = this.operand1.read();
			var numBitsIn = this.sizeOperand * 8;
			// Modulo, because shifting by bit-length of operand ( eg. 16/32 ) is same as shifting by zero
			var numBitsToShift = this.operand2.read() % numBitsIn;
			var bitHigh;
			//debugger;
			this.operand1.write((bits << numBitsToShift) & this.mask_sizeOperand);
			bitHigh = bits & (1 << (numBitsIn - 1));
			// High order-bit written to Carry Flag
			CPU.CF.setBin(bitHigh);
			// Overflow Flag defined only if single-shift
			if ( numBitsToShift == 1 ) {
				// OF set if high bit of answer is same as result of Carry Flag
				CPU.OF.setBin(bitHigh != (bits & (1 << (numBitsIn - 2))) ? 1 : 0);
			}
		// Shift Right ( with UNsigned divide )
		}, "SHR": function () {
			var bits = this.operand1.read();
			var numBitsIn = this.sizeOperand * 8;
			// Modulo, because shifting by bit-length of operand ( eg. 16/32 ) is same as shifting by zero
			var numBitsToShift = this.operand2.read() % numBitsIn;
			
			// Use JS operator for right-shift with zero extend ( shift on zeroes instead of sign bits )
			this.operand1.write((bits >> numBitsToShift) & this.mask_sizeOperand);
			// Low order-bit written to Carry Flag
			CPU.CF.setBin(bits & 0x01);
			// Overflow Flag defined only if single-shift
			if ( numBitsToShift == 1 ) {
				// OF set to high-order bit of original operand
				CPU.OF.setBin(bits & (1 << (numBitsIn - 1)));
			}
		// Shift Arithmetic Right ( with signed divide )
		}, "SAR": function () {
			var bits = this.operand1.signExtend();
			var numBitsIn = this.sizeOperand * 8;
			// Modulo, because shifting by bit-length of operand ( eg. 16/32 ) is same as shifting by zero
			var numBitsToShift = this.operand2.read() % numBitsIn;
			
			// Use JS operator for right-shift with sign extend ( shift on sign bits instead of zeroes )
			this.operand1.write(bits >>> numBitsToShift);
			// Low order-bit written to Carry Flag
			CPU.CF.setBin(bits & 0x01);
			// Overflow Flag defined only if single-shift
			if ( numBitsToShift == 1 ) {
				// OF always zero/cleared
				CPU.OF.clear();
			}
		// Integer Subtraction with Borrow
		}, "SBB": function () {
			//debugger;
			
			// NB: Addition and subtraction handle two's complement the same way
			//	for both unsigned and signed interpretations of numbers
			var val1 = this.operand1.signExtend()
				, val2 = this.operand2.signExtend()
				, res = (val1 - (val2 + CPU.CF.get())) & this.mask_sizeOperand;
			
			this.operand1.write(res);
			
			this.setFlags(val1, val2, res);
		// Integer Subtraction
		}, "SUB": function () {
			// NB: Addition and subtraction handle two's complement the same way
			//	for both unsigned and signed interpretations of numbers
			var val1 = this.operand1.signExtend()
				, val2 = this.operand2.signExtend()
				, res = (val1 - val2) & this.mask_sizeOperand;
			
			this.operand1.write(res);
			
			this.setFlags(val1, val2, res);
		// Scan/Compare String Data (Byte, Word or Dword)
		//	TODO: could be polymorphic, one func for each string-repeat type
		//	TODO: there is potential for speed ups here by using native .indexOf() / .slice() and similar
		//		array methods, instead of a possibly slow loop over each individual byte
		}, "SCAS": function () {
			var sizeOperand = this.sizeOperand;
			// This is the difference between SCAS and CMPS: here,
			//	the value in AL/(E)AX is compared with the chars in string,
			//	so only needs to be read once
			var val1 = this.operand1.read(), val2
				, res
				, cx, edi, ediStart, ediEnd
				, len;
			
			switch ( this.repeat ) {
			// Common case; no repeat prefix
			case "":
				val2 = this.operand2.read();
				res = (val1 - val2) & this.mask_sizeOperand;
				
				// Direction Flag set, decrement (scan in reverse direction)
				if ( CPU.DF.get() ) {
					CPU.EDI.set(CPU.EDI.get() - sizeOperand);
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					CPU.EDI.set(CPU.EDI.get() + sizeOperand);
				}
				// Do not store result of sub/compare; only flags
				this.setFlags(val1, val2, res);
				break;
			// Repeat CX times
			case "#REP":
				jemul8.problem("Instruction.execute() :: SCAS - #REP invalid");
			// Repeat while Equal, max CX times
			case "#REPE":
				cx = CPU.CX.get();
				len = cx * sizeOperand;
				edi = ediStart = CPU.EDI.get();
				// Direction Flag set, decrement (scan in reverse direction)
				if ( CPU.DF.get() ) {
					ediEnd = edi - len;
					for ( ; edi >= ediEnd ; edi -= sizeOperand ) {
						CPU.EDI.set(edi);
						val2 = this.operand2.read();
						res = (val1 - val2) & this.mask_sizeOperand;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
						// NB: This test cannot be in the for(...) condition
						if ( !CPU.ZF.get() ) { break; }
					}
					CPU.CX.set(ediStart - edi);
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					ediEnd = edi + len;
					for ( ; edi < ediEnd ; edi += sizeOperand ) {
						CPU.EDI.set(edi);
						val2 = this.operand2.read();
						res = (val1 - val2) & this.mask_sizeOperand;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
						// NB: This test cannot be in the for(...) condition
						if ( !CPU.ZF.get() ) { break; }
					}
					CPU.CX.set(edi - ediStart);
				}
				CPU.EDI.set(edi);
				break;
			// Repeat while Not Equal, max CX times
			case "#REPNE":
				cx = CPU.CX.get();
				len = cx * sizeOperand;
				edi = ediStart = CPU.EDI.get();
				// Direction Flag set, decrement (scan in reverse direction)
				if ( CPU.DF.get() ) {
					ediEnd = edi - len;
					for (; edi >= ediEnd ; edi -= sizeOperand ) {
						CPU.EDI.set(edi);
						val2 = this.operand2.read();
						res = (val1 - val2) & this.mask_sizeOperand;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
						// NB: This test cannot be in the for(...) condition
						if ( CPU.ZF.get() ) { break; }
					}
					CPU.CX.set(cx - (ediStart - edi) / sizeOperand);
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					ediEnd = edi + len;
					for (; edi < ediEnd ; edi += sizeOperand ) {
						CPU.EDI.set(edi);
						val2 = this.operand2.read();
						res = (val1 - val2) & this.mask_sizeOperand;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
						// NB: This test cannot be in the for(...) condition
						if ( CPU.ZF.get() ) { break; }
					}
					CPU.CX.set(cx - (edi - ediStart) / sizeOperand);
				}
				CPU.EDI.set(edi);
				break;
			default:
				jemul8.problem("Execute (SCAS) :: invalid string repeat operation/prefix.");
			}
		/* ======= Conditional Byte Set Instructions ======= */
		/*
		 *	Many of these conditions may be interpreted in one of
		 *	several ways; the mnemonics used here are the first
		 *	in the list provided in the Intel Instruction Formats & Encodings,
		 *	Table B-8.
		 */
		// Set Byte if Overflow
		}, "SETO": function () {
			// Condition met
			if ( CPU.OF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if NO Overflow
		}, "SETNO": function () {
			// Condition met
			if ( !CPU.OF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if Below
		}, "SETB": function () {
			// Condition met
			if ( CPU.CF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if NOT Below
		}, "SETNB": function () {
			// Condition met
			if ( !CPU.CF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if Equal
		}, "SETE": function () {
			// Condition met
			if ( CPU.ZF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if NOT Equal
		}, "SETNE": function () {
			// Condition met
			if ( !CPU.ZF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if Below or Equal
		}, "SETBE": function () {
			// Condition met
			if ( CPU.CF.get() || CPU.ZF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if NOT Below or Equal
		}, "SETNBE": function () {
			// Condition met
			if ( !CPU.CF.get() && !CPU.ZF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if Sign
		}, "SETS": function () {
			// Condition met
			if ( CPU.SF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if NOT Sign
		}, "SETNS": function () {
			// Condition met
			if ( !CPU.SF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if Parity / Parity Even
		}, "SETP": function () {
			// Condition met
			if ( CPU.PF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if NOT Parity / Parity Even
		}, "SETNP": function () {
			// Condition met
			if ( !CPU.PF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if Less Than
		}, "SETL": function () {
			// Condition met
			if ( CPU.SF.get() !== CPU.OF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if NOT Less Than
		}, "SETNL": function () {
			// Condition met
			if ( CPU.SF.get() === CPU.OF.get() ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if Less Than or Equal
		}, "SETLE": function () {
			// Condition met
			if ( CPU.ZF.get() && (CPU.SF.get() !== CPU.OF.get()) ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		// Set Byte if NOT Less Than or Equal
		}, "SETNLE": function () {
			// Condition met
			if ( !CPU.ZF.get() && (CPU.SF.get() === CPU.OF.get()) ) {
				this.operand1.write(1);
			} else {
				this.operand1.write(0);
			}
		/* ======= /Conditional Byte Set Instructions ======= */
		// Store Global Descriptor Table Register
		}, "SGDT": function () {
			jemul8.problem("Execute (SGDT) :: unsupported");
		// Store Interrupt Descriptor Table Register
		}, "SIDT": function () {
			jemul8.problem("Execute (SIDT) :: unsupported");
		// Shift Left - Double Precision
		}, "SHLD": function () {
			jemul8.problem("Execute (SHLD) :: unsupported");
		// Shift Right - Double Precision
		}, "SHRD": function () {
			jemul8.problem("Execute (SHRD) :: unsupported");
		// Store Local Descriptor Table Register
		}, "SLDT": function () {
			jemul8.problem("Execute (SLDT) :: unsupported");
		// Store Machine Status Word
		}, "SMSW": function () {
			this.operand1.write(CPU.MSW.get());
		// Set Carry flag
		}, "STC": function () {
			CPU.CF.set();
		// Set Direction flag
		}, "STD": function () {
			CPU.DF.set();
		// Set Interrupt flag - enables recognition of all hardware interrupts
		}, "STI": function () {
			CPU.IF.set();
		// Store String Data ( Byte, Word or Dword )
		//	TODO: could be polymorphic, one func for each string-repeat type
		//	TODO: there is potential for speed ups here by using native .indexOf() / .slice() and similar
		//		array methods, instead of a possibly slow loop over each individual byte
		}, "STOS": function () {
			var sizeOperand = this.sizeOperand;
			var val1;
			var val2;
			var res;
			var edi;
			var ediEnd;
			var len;
			
			switch ( this.repeat ) {
			// Common case; no repeat prefix
			case "":
				val1 = this.operand1.read();
				val2 = this.operand2.read();
				res = (val1 - val2) & this.mask_sizeOperand;
				
				// Direction Flag set, decrement ( scan in reverse direction )
				if ( CPU.DF.get() ) {
					CPU.EDI.set(CPU.EDI.get() - sizeOperand);
				// Direction Flag clear, increment ( scan in forward direction )
				} else {
					CPU.EDI.set(CPU.EDI.get() + sizeOperand);
				}
				// Do not store result of subtraction; only flags
				this.setFlags(val1, val2, res);
				break;
			// Repeat CX times
			case "#REP":
				len = CPU.CX.get() * sizeOperand;
				edi = CPU.EDI.get();
				// Direction Flag set, decrement (scan in reverse direction)
				if ( CPU.DF.get() ) {
					ediEnd = edi - len;
					for ( ; edi >= ediEnd ; edi -= sizeOperand ) {
						CPU.EDI.set(edi);
						val1 = this.operand1.read();
						val2 = this.operand2.read();
						res = (val1 - val2) & this.mask_sizeOperand;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
					}
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					ediEnd = edi + len;
					for ( ; edi < ediEnd ; edi += sizeOperand ) {
						CPU.EDI.set(edi);
						val1 = this.operand1.read();
						val2 = this.operand2.read();
						res = (val1 - val2) & this.mask_sizeOperand;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
					}
				}
				CPU.EDI.set(edi);
				break;
			// Repeat while Equal, max CX times
			case "#REPE":
				len = CPU.CX.get() * sizeOperand;
				edi = CPU.EDI.get();
				// Direction Flag set, decrement (scan in reverse direction)
				if ( CPU.DF.get() ) {
					ediEnd = edi - len;
					for ( ; edi >= ediEnd ; edi -= sizeOperand ) {
						CPU.EDI.set(edi);
						val1 = this.operand1.read();
						val2 = this.operand2.read();
						res = (val1 - val2) & this.mask_sizeOperand;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
						// NB: This test cannot be in the for(...) condition
						if ( !CPU.ZF.get() ) { break; }
					}
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					ediEnd = edi + len;
					for ( ; edi < ediEnd ; edi += sizeOperand ) {
						CPU.EDI.set(edi);
						val1 = this.operand1.read();
						val2 = this.operand2.read();
						res = (val1 - val2) & this.mask_sizeOperand;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
						// NB: This test cannot be in the for(...) condition
						if ( !CPU.ZF.get() ) { break; }
					}
				}
				CPU.EDI.set(edi);
				break;
			// Repeat while Not Equal, max CX times
			case "#REPNE":
				len = CPU.CX.get() * sizeOperand;
				edi = CPU.EDI.get();
				// Direction Flag set, decrement (scan in reverse direction)
				if ( CPU.DF.get() ) {
					ediEnd = edi - len;
					for ( ; edi >= ediEnd ; edi -= sizeOperand ) {
						CPU.EDI.set(edi);
						val1 = this.operand1.read();
						val2 = this.operand2.read();
						res = (val1 - val2) & this.mask_sizeOperand;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
						// NB: This test cannot be in the for(...) condition
						if ( CPU.ZF.get() ) { break; }
					}
				// Direction Flag clear, increment (scan in forward direction)
				} else {
					ediEnd = edi + len;
					for ( ; edi < ediEnd ; edi += sizeOperand ) {
						CPU.EDI.set(edi);
						val1 = this.operand1.read();
						val2 = this.operand2.read();
						res = (val1 - val2) & this.mask_sizeOperand;
						// Do not store result of subtraction; only flags
						this.setFlags(val1, val2, res);
						// NB: This test cannot be in the for(...) condition
						if ( CPU.ZF.get() ) { break; }
					}
				}
				CPU.EDI.set(edi);
				break;
			default:
				jemul8.problem("Execute (SCAS) :: invalid string repeat operation/prefix.");
			}
		// Store Task Register
		}, "STR": function () {
			jemul8.problem("Execute (STR) :: unsupported");
		// Logical Compare
		}, "TEST": function () {
			var val1 = this.operand1.read()
				, val2 = this.operand2.read()
				, res = val1 & val2;
			
			// Do not store result of subtraction; only flags
			this.setFlags(val1, val2, res);
		// Verify a Segment for Reading
		}, "VERR": function () {
			jemul8.problem("Execute (VERR) :: unsupported");
		// Verify a Segment for Writing
		}, "VERW": function () {
			jemul8.problem("Execute (VERW) :: unsupported");
		// Wait until BUSY# Pin is Inactive (HIGH)
		}, "WAIT": function () {
			// Suspend execution of 80386 Instructions until BUSY# is inactive;
			//	driven by numeric processor extension 80287
			
			// We do not use a math coprocessor, so this can safely be ignored for now.
		// Exchange Register/Memory with Register
		}, "XCHG": function () {
			// If a memory operand is involved, BUS LOCK is asserted during exchange,
			//	regardless of LOCK# prefix or IOPL value ( so always atomic ).
			var valTemp = this.operand1.read();
			
			this.operand1.write(this.operand2.read());
			this.operand2.write(valTemp);
		// Table Look-up Translation
		}, "XLAT": function () {
			if ( this.sizeAddress <= 2 ) {
				CPU.AL.set(CPU.BX.get() + this.AL.get());
			} else {
				CPU.AL.set(CPU.EBX.get() + this.AL.get());
			}
		// Logical Exclusive OR
		}, "XOR": function () {
			var val1 = this.operand1.read();
			var val2 = this.operand2.read();
			var res = (val1 ^ val2) & this.mask_sizeOperand;
			
			this.operand1.write(res);
			
			this.setFlags(val1, val2, res);
		}};
	};
	
	// Whether the specified InstructionPointer is within the bounds of the current Code Segment
	Instruction.prototype.inCodeSegmentLimits = function ( EIP ) {
		// TODO...
		return true;
	};
	// Return Stack space available ( in bytes )
	Instruction.prototype.getStackSpace = function () {
		// This will do for now...
		return 16;
	};
	
	/* ====== Private ====== */
	// To throw a CPU exception / fault ( eg. General Protection )
	function CPUException( type, code ) {
		jemul8.debug("CPU exception: " + type + ", " + code);
	}
	
	// For the conditional (Jxx) instructions
	function jumpShortOrNear( insn ) {
		var op1 = insn.operand1
			, cpu = insn.machine.cpu
			, val;
		
		// 1-byte operand; jump "short",
		if ( insn.sizeOperand === 1 ) {
			// Sign-extend the 1-byte jump distance, so that
			//	it will wrap if negative
			val = op1.signExtend(2);
			// Address is relative to EIP if not a pointer,
			//	otherwise it is "absolute indirect" (a non-relative
			//	address to jump to that is stored in memory)
			if ( !op1.isPointer ) {
				val += cpu.IP.get();
			}
		// 2/4-byte operand; jump "near"
		} else/* if ( insn.sizeOperand >= 2 )*/ {
			// 2-byte: No point/need for sign-extension, as IP & operand
			//	are both 2-bytes wide.
			// 4-byte: Definitely no sign-extension...
			val = op1.read();
			// Address is relative to EIP if not a pointer,
			//	otherwise it is "absolute indirect" (a non-relative
			//	address to jump to that is stored in memory)
			if ( !op1.isPointer ) {
				val += cpu.EIP.get();
			}
		}
		
		// Wrap 16-bit addresses
		if ( insn.sizeOperand <= 2 ) {
			cpu.EIP.set(val & 0x0000FFFF); // Zero-out high word of EIP
		} else { // 32-bit wrapped in .set()
			cpu.EIP.set(val);
		}
	}
	
	/* ============ State storage for Lazy Flags eval later ============ */
	/* 	To be called after executing any Instruction which modifies
	 *	one or more flags. The different versions of the function
	 *	below are intended to save valuable time not storing data when
	 *	it is not needed; clearing the unused values is not needed either,
	 *	as the lazy evaluator will just ignore them.
	 */
	
	// Operand 1, 2 and result
	Instruction.prototype.setFlags = function ( val1, val2, res ) {
		var CPU = this.machine.cpu;
		
		CPU.valLast1 = val1;
		CPU.valLast2 = val2;
		CPU.resLast = res;
		CPU.insnLast = this;
		//CPU.name_insnLast = this.name;
		CPU.EFLAGS.bitsDirty = 0xFFFFFFFF;
	};
	// Operand 1 and result only
	Instruction.prototype.setFlags_Op1 = function ( val1, res ) {
		var CPU = this.machine.cpu;
		
		CPU.valLast1 = val1;
		CPU.resLast = res;
		CPU.insnLast = this;
		//CPU.name_insnLast = this.name;
		CPU.EFLAGS.bitsDirty = 0xFFFFFFFF;
	};
	// Operand 2 and result only
	Instruction.prototype.setFlags_Op2 = function ( val2, res ) {
		var CPU = this.machine.cpu;
		
		CPU.valLast2 = val2;
		CPU.resLast = res;
		CPU.insnLast = this;
		//CPU.name_insnLast = this.name;
		CPU.EFLAGS.bitsDirty = 0xFFFFFFFF;
	};
	// Result only
	Instruction.prototype.setFlags_Result = function ( res ) {
		var CPU = this.machine.cpu;
		
		CPU.resLast = res;
		CPU.insnLast = this;
		//CPU.name_insnLast = this.name;
		CPU.EFLAGS.bitsDirty = 0xFFFFFFFF;
	};
	
	// Bitwise OR the EFLAGS dirty mask with one of these to indicate
	//	that flag may have been modified
	var bit_ormask_CF = 1;
	var bit_ormask_PF = 2;
	var bit_ormask_AF = 4;
	var bit_ormask_ZF = 8;
	var bit_ormask_SF = 16;
	var bit_ormask_OF = 32;
	/* ============ /State storage for Lazy Flags eval later ============ */
	
	/* ====== /Private ====== */
	
	// Exports
	jemul8.Instruction = Instruction;
});
