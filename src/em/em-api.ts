// This file is part of nbind, copyright (C) 2014-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

// This file contains JavaScript functions directly exposed to C++ through
// Emscripten library exports.

import {
	setEvil,
	publishNamespace,
	defineHidden,
	exportLibrary,
	dep
} from 'emscripten-library-decorator';
import {_nbind as _globals} from './Globals';
import {_nbind as _type} from './BindingType';
import {_nbind as _class} from './BindClass';
import {_nbind as _callback} from './Callback';
import {_nbind as _value} from './ValueObj';
import {_nbind as _std} from './BindingStd';
import {_nbind as _caller} from './Caller';
import {_nbind as _resource} from './Resource';
import * as common from '../common';

export {_globals, _type, _class, _callback, _value, _std, _caller, _resource};

// Let decorators run eval in current scope to read function source code.
setEvil((code: string) => eval(code));

const _defineHidden = defineHidden;
const _SignatureType = common.SignatureType;
type _SignatureType = common.SignatureType;
const _removeAccessorPrefix = common.removeAccessorPrefix;

export namespace _nbind {
	export var Pool = _globals.Pool;
}

export namespace _nbind {
	export type Func = _globals.Func;

	export var typeList: typeof _globals.typeList;
	export var bigEndian: typeof _globals.bigEndian;

	export var addMethod: typeof _globals.addMethod;
	export var readTypeIdList: typeof _globals.readTypeIdList;
	export var readAsciiString: typeof _globals.readAsciiString;
	export var readPolicyList: typeof _globals.readPolicyList;

	export var BindType: typeof _type.BindType;
	export var PrimitiveType: typeof _type.PrimitiveType;
	export var BooleanType: typeof _type.BooleanType;
	export var CStringType: typeof _type.CStringType;

	export var Wrapper: typeof _class.Wrapper;
	export var BindClass: typeof _class.BindClass;
	export var BindClassPtr: typeof _class.BindClassPtr;
	export var ptrMarker: typeof _class.ptrMarker;

	export var CallbackType: typeof _callback.CallbackType;
	export var unregisterCallback: typeof _callback.unregisterCallback;

	export var callbackRefCountList: typeof _callback.callbackRefCountList;
	export var callbackSignatureList: typeof _callback.callbackSignatureList;

	export var CreateValueType: typeof _value.CreateValueType;
	export var Int64Type: typeof _value.Int64Type;
	export var popValue: typeof _value.popValue;

	export var StringType: typeof _std.StringType;

	export var makeCaller: typeof _caller.makeCaller;
	export var makeMethodCaller: typeof _caller.makeMethodCaller;
}

publishNamespace('_nbind');

@exportLibrary
class nbind { // tslint:disable-line:class-name

	@dep('_nbind')
	static _nbind_register_endian(byte: number) {
		if(byte == 1) _nbind.bigEndian = true;
	}

	@dep('_nbind')
	static _nbind_register_pool(
		pageSize: number,
		usedPtr: number,
		rootPtr: number,
		pagePtr: number
	) {
		_nbind.Pool.pageSize = pageSize;
		_nbind.Pool.usedPtr = usedPtr / 4;
		_nbind.Pool.rootPtr = rootPtr;
		_nbind.Pool.pagePtr = pagePtr / 4;
	}

	@dep('_nbind')
	static _nbind_register_type(id: number, namePtr: number) {
		const name = _nbind.readAsciiString(namePtr);
		type TypeConstructor = { new(id: number, name: string): _type.BindType };
		const constructorTbl: { [name: string]: TypeConstructor } = {
			'bool': _nbind.BooleanType,
			'cbFunction &': _nbind.CallbackType,
			'std::string': _nbind.StringType,
			'Int64': _nbind.Int64Type,
			'_nbind_new': _nbind.CreateValueType
		};

		const constructor = constructorTbl[name] || _nbind.BindType;

		// tslint:disable-next-line:no-unused-expression
		new constructor(id, name);
	}

	@dep('_nbind')
	static _nbind_register_primitive(id: number, size: number, flag: number) {
		const isSignless = flag & 16;
		const isConst    = flag & 8;
		const isPointer  = flag & 4;
		const isFloat    = flag & 2;
		const isUnsigned = flag & 1;

		let name = isConst ? 'const ' : '';

		if(isSignless) {
			name += 'char';
		} else if(isPointer) {
			if(isUnsigned) name += 'un';
			name += 'signed char';
		} else {
			name += (
				(isUnsigned ? 'u' : '') +
				(isFloat ? 'float' : 'int') +
				(size * 8 + '_t')
			);
		}

		if(isPointer) {
			// tslint:disable-next-line:no-unused-expression
			new _nbind.CStringType(id, name + ' *');
		} else if(size == 8 && !isFloat) {
			// tslint:disable-next-line:no-unused-expression
			new _nbind.Int64Type(id, name);
		} else {
			// tslint:disable-next-line:no-unused-expression
			new _nbind.PrimitiveType(id, name, size, !!isUnsigned, !!isFloat);
		}
	}

	@dep('_nbind', '__extends')
	static _nbind_register_class(idListPtr: number, namePtr: number) {
		const name = _nbind.readAsciiString(namePtr);
		const idList = HEAPU32.subarray(idListPtr / 4, idListPtr / 4 + 3);

		class Bound extends _nbind.Wrapper {
			constructor(marker: {}, ptr: number) {
				// super() never gets called here but TypeScript 1.8 requires it.
				if((false && super()) || !(this instanceof Bound)) {

					// Constructor called without new operator.
					// Make correct call with given arguments.
					// Few ways to do this work. This one should. See:
					// http://stackoverflow.com/questions/1606797
					// /use-of-apply-with-new-operator-is-this-possible

					return(new (Function.prototype.bind.apply(
						Bound, // arguments.callee
						Array.prototype.concat.apply([null], arguments)
					))());
				}

				super();

				_defineHidden(
					marker === _nbind.ptrMarker ? ptr :
					this.__nbindConstructor.apply(this, arguments)
				)(this, '__nbindPtr');
			}

			@_defineHidden()
			__nbindConstructor: _nbind.Func; // tslint:disable-line:variable-name

			@_defineHidden()
			__nbindValueConstructor: _nbind.Func; // tslint:disable-line:variable-name
		}

		/* tslint:disable:no-unused-expression */

		new _nbind.BindClass(idList[0], name, Bound);
		new _nbind.BindClassPtr(idList[1], name + ' *', Bound);
		new _nbind.BindClassPtr(idList[2], 'const ' + name + ' *', Bound);

		/* tslint:enable:no-unused-expression */

		// Export the class.
		Module[name] = Bound;
	}

	@dep('_nbind')
	static _nbind_register_constructor(
		typeID: number,
		policyListPtr: number,
		typeListPtr: number,
		typeCount: number,
		ptr: number,
		ptrValue: number
	) {
		const policyTbl = _nbind.readPolicyList(policyListPtr);
		const typeList = _nbind.readTypeIdList(typeListPtr, typeCount);
		const proto = (_nbind.typeList[typeID] as _class.BindClass).proto.prototype;

		// The constructor returns a pointer to the new object.
		// It fits in uint32_t.

		typeList[0] = 'uint32_t';

		_nbind.addMethod(
			proto,
			'__nbindConstructor',
			_nbind.makeCaller(null, 0, ptr, typeList, policyTbl),
			typeCount - 1
		);

		// First argument is a pointer to the C++ object to construct in place.
		// It fits in uint32_t.

		typeList.splice(0, 1, 'void', 'uint32_t');

		_nbind.addMethod(
			proto,
			'__nbindValueConstructor',
			_nbind.makeCaller(null, 0, ptrValue, typeList, policyTbl),
			typeCount
		);
	}

	@dep('_nbind')
	static _nbind_register_destructor(typeID: number, ptr: number) {
		_nbind.addMethod(
			(_nbind.typeList[typeID] as _class.BindClass).proto.prototype,
			'free',
			_nbind.makeMethodCaller(ptr, 0, typeID, ['void'], null),
			0
		);
	}

	@dep('_nbind')
	static _nbind_register_function(
		typeID: number,
		policyListPtr: number,
		typeListPtr: number,
		typeCount: number,
		ptr: number,
		namePtr: number,
		num: number,
		direct: number
	) {
		const name = _nbind.readAsciiString(namePtr);
		const policyTbl = _nbind.readPolicyList(policyListPtr);
		const typeList = _nbind.readTypeIdList(typeListPtr, typeCount);
		let target: any;

		if(typeID) {
			target = (_nbind.typeList[typeID] as _class.BindClass).proto;
		} else {
			target = Module;
		}

		_nbind.addMethod(
			target,
			name,
			_nbind.makeCaller(ptr, num, direct, typeList, policyTbl),
			typeCount - 1
		);
	}

	@dep('_nbind', '_SignatureType', '_removeAccessorPrefix')
	static _nbind_register_method(
		typeID: number,
		policyListPtr: number,
		typeListPtr: number,
		typeCount: number,
		ptr: number,
		namePtr: number,
		num: number,
		signatureType: _SignatureType
	) {
		let name = _nbind.readAsciiString(namePtr);
		const policyTbl = _nbind.readPolicyList(policyListPtr);
		const typeList = _nbind.readTypeIdList(typeListPtr, typeCount);
		const proto = (_nbind.typeList[typeID] as _class.BindClass).proto.prototype;

		if(signatureType == _SignatureType.method) {
			_nbind.addMethod(
				proto,
				name,
				_nbind.makeMethodCaller(ptr, num, typeID, typeList, policyTbl),
				typeCount - 1
			);

			return;
		}

		name = _removeAccessorPrefix(name);

		if(signatureType == _SignatureType.setter) {

			// A setter is always followed by a getter, so we can just
			// temporarily store an invoker in the property.
			// The getter definition then binds it properly.

			proto[name] = _nbind.makeMethodCaller(ptr, num, typeID, typeList, policyTbl);
		} else {
			Object.defineProperty(proto, name, {
				configurable: true,
				enumerable: true,
				get: _nbind.makeMethodCaller(ptr, num, typeID, typeList, policyTbl),
				set: proto[name]
			});
		}
	}

	@dep('_nbind')
	static nbind_debug() { debugger; }

}
