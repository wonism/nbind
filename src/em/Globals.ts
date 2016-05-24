// This file is part of nbind, copyright (C) 2014-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {setEvil, prepareNamespace} from 'emscripten-library-decorator';
import {_nbind as _type} from './BindingType';
import {_nbind as _caller} from './Caller';
import {_nbind as _resource} from './Resource';

// Let decorators run eval in current scope to read function source code.
setEvil((code: string) => eval(code));

// Namespace that will be made available inside Emscripten compiled module.

export namespace _nbind {

	// Generic table and list of functions.

	export type Func = (...args: any[]) => any;
	export type FuncTbl = { [name: string]: Func };
	export type FuncList = { (...args: any[]): any }[];
	export type Invoker = (ptr: number, ...args: any[]) => any;
	export type TypeIDList = (number | string)[];

	export var resources: typeof _resource.resources;
	export var listResources: typeof _resource.listResources;

	export var makeOverloader: typeof _caller.makeOverloader;

	export interface ValueObject {
		fromJS(output: () => void): void;

		/** This is mandatory, but dynamically created inside nbind. */
		__nbindValueConstructor?: Func;
	}

	// Base class for wrapped instances of bound C++ classes.

	export class Wrapper {
		free: () => void;

		/** Dynamically set by _nbind_register_constructor.
		  * Calls the C++ constructor and returns a numeric heap pointer. */
		__nbindConstructor: (...args: any[]) => number;
		__nbindValueConstructor: Func;
		/** __nbindConstructor return value. */
		__nbindPtr: number;
	}

	// Any subtype (not instance but type) of Wrapper.
	// Declared as anything that constructs something compatible with Wrapper.

	export interface WrapperClass {
		new(...args: any[]): Wrapper;
	}

	export var callbackSignatureList: Func[] = [];

	// Callbacks are stored in a list, so C++ code can find them by number.
	// A reference count allows storing them in C++ without leaking memory.
	// The first element is a dummy value just so that a valid index to
	// the list always tests as true (useful for the free list implementation).

	export var callbackList: Func[] = [null];
	export var callbackRefCountList: number[] = [0];

	// Free list for recycling available slots in the callback list.

	export var callbackFreeList: number[] = [];

	export function registerCallback(func: Func) {
		if(typeof(func) != 'function') _nbind.throwError('Type mismatch');

		var num = callbackFreeList.pop() || callbackList.length;

		callbackList[num] = func;
		callbackRefCountList[num] = 1;

		return(num);
	}

	export var valueList: ValueObject[] = [];

	export var valueFreeList: number[] = [];

	export function pushValue(value: ValueObject) {
		var num = valueFreeList.pop() || valueList.length;

		valueList[num] = value;
		return(num);
	}

	export function popValue(num: number) {
		var obj = valueList[num];

		valueList[num] = null;
		valueFreeList.push(num);
		return(obj);
	}

	// Look up a list of type objects based on their numeric typeID or name.

	export function getTypes(idList: TypeIDList) {
		return(idList.map((id: number | string) => {
			if(typeof(id) == 'number') {
				var type = _nbind.typeList[id as number];
				if(type) return(type);

				var placeholderFlag = HEAPU8[id as number];

				console.log('placeholderFlag = ' + placeholderFlag);
				console.log('ID = ' + id);
for(var i = id as number; i < (id as number) + 10; ++i) console.log(HEAPU8[i]);
				id = HEAPU32[((id as number) >> 2) + 1];
				console.log('ID = ' + id);
				var type = _nbind.typeList[id as number];
				console.log(type);
				if(type) return(type);
			} else return(_nbind.typeTbl[id as string]);
		}));
	}

	// Generate a mangled signature from argument types.
	// Asm.js functions can only be called though Emscripten-generated invoker functions,
	// with slightly mangled type signatures appended to their names.

	export function makeSignature(typeList: _type.BindType[]) {
		var mangleMap: { [name: string]: string; } = {
			float64_t: 'd',
			float32_t: 'f',
			void: 'v'
		}

		return(typeList.map((type: _type.BindType) => (mangleMap[type.name] || 'i')).join(''));
	}

	// Add a method to a C++ class constructor (for static methods) or prototype,
	// or overload an existing method.

	export function addMethod(obj: FuncTbl, name: string, func: Func, arity: number) {
		var overload = obj[name] as any;

		// Check if the function has been overloaded.

		if(overload) {
			if(overload.arity || overload.arity === 0) {
				// Found an existing function, but it's not an overloader.
				// Make a new overloader and add the existing function to it.

				overload = makeOverloader(overload, overload.arity);
				obj[name] = overload;
			}

			// Add this function as an overload.

			overload.addMethod(func, arity);
		} else {
			// Add a new function and store its arity in case it gets overloaded.

			(func as any).arity = arity;

			obj[name] = func;
		}
	}

	// Mapping from numeric typeIDs and type names to objects with type information.

	export var typeTbl: { [name: string]: _type.BindType } = {};
	export var typeList: _type.BindType[] = [];

	// Enum specifying if a method is a getter or setter or not.

	export var MethodType: {
		method: number;
		getter: number;
		setter: number;
	} = {} as any;

	export var value: any;

	export function throwError(message: string) {
		throw({ message: message });
	}

	// Export the namespace to Emscripten compiled output.
	// This must be at the end of the namespace!
	// The dummy class is needed because unfortunately namespaces can't have decorators.
	// Everything after it inside the namespace will be discarded.

	@prepareNamespace('_nbind')
	export class _ {}
}