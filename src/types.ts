export type expectedAttrs = string[] | number[] | boolean[] | string | number | boolean | unknown;

export interface Attrs {
	name: expectedAttrs;
	value: expectedAttrs;
	setAt: number;
}

export interface IExposures {
	id: number;
	name: string;
	exposedAt: number;
	unit: string;
	variant: number | string;
	assigned: string | boolean;
	eligible: string | boolean;
	overridden: string | boolean;
	fullOn: string | boolean;
	custom: string | boolean;
}

export interface IGoals {
	name: string;
	properties: any;
	achievedAt: number;
}
export interface IUnits {
	session_id?: string;
	user_id?: number;
	type: string;
	uid: any;
}

export interface IRequest {
	publishedAt?: number;
	units?: IUnits[];
	hashed?: boolean;
	goals?: IGoals[];
	exposures?: IExposures[];
	attributes?: Attrs[];
	test?: number;
}
