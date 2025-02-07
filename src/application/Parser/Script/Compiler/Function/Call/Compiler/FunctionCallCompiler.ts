import { IReadOnlyFunctionCallArgumentCollection } from '@/application/Parser/Script/Compiler/Function/Call/Argument/IFunctionCallArgumentCollection';
import { ICompiledCode } from './ICompiledCode';
import { ISharedFunctionCollection } from '../../ISharedFunctionCollection';
import { IFunctionCallCompiler } from './IFunctionCallCompiler';
import { IExpressionsCompiler } from '../../../Expressions/IExpressionsCompiler';
import { ExpressionsCompiler } from '../../../Expressions/ExpressionsCompiler';
import { ISharedFunction, IFunctionCode } from '../../ISharedFunction';
import { IFunctionCall } from '@/application/Parser/Script/Compiler/Function/Call/IFunctionCall';
import { FunctionCall } from '../FunctionCall';
import { FunctionCallArgumentCollection } from '../Argument/FunctionCallArgumentCollection';
import { FunctionCallArgument } from '@/application/Parser/Script/Compiler/Function/Call/Argument/FunctionCallArgument';

export class FunctionCallCompiler implements IFunctionCallCompiler {
    public static readonly instance: IFunctionCallCompiler = new FunctionCallCompiler();

    protected constructor(
        private readonly expressionsCompiler: IExpressionsCompiler = new ExpressionsCompiler()) {
    }

    public compileCall(
        calls: IFunctionCall[],
        functions: ISharedFunctionCollection): ICompiledCode {
        if (!functions) { throw new Error('undefined functions'); }
        if (!calls) { throw new Error('undefined calls'); }
        if (calls.some((f) => !f)) { throw new Error('undefined function call'); }
        const context: ICompilationContext = {
            allFunctions: functions,
            callSequence: calls,
            expressionsCompiler: this.expressionsCompiler,
        };
        const code = compileCallSequence(context);
        return code;
    }
}

interface ICompilationContext {
    allFunctions: ISharedFunctionCollection;
    callSequence: readonly IFunctionCall[];
    expressionsCompiler: IExpressionsCompiler;
}

interface ICompiledFunctionCall {
    readonly code: string;
    readonly revertCode: string;
}

function compileCallSequence(context: ICompilationContext): ICompiledFunctionCall {
    const compiledFunctions = new Array<ICompiledFunctionCall>();
    for (const call of context.callSequence) {
        const compiledCode = compileSingleCall(call, context);
        compiledFunctions.push(...compiledCode);
    }
    return {
        code: merge(compiledFunctions.map((f) => f.code)),
        revertCode: merge(compiledFunctions.map((f) => f.revertCode)),
    };
}

function compileSingleCall(call: IFunctionCall, context: ICompilationContext): ICompiledFunctionCall[] {
    const func = context.allFunctions.getFunctionByName(call.functionName);
    ensureThatCallArgumentsExistInParameterDefinition(func, call.args);
    if (func.body.code) { // Function with inline code
        const compiledCode = compileCode(func.body.code, call.args, context.expressionsCompiler);
        return [ compiledCode ];
    } else { // Function with inner calls
        return func.body.calls
            .map((innerCall) => {
                const compiledArgs = compileArgs(innerCall.args, call.args, context.expressionsCompiler);
                const compiledCall = new FunctionCall(innerCall.functionName, compiledArgs);
                return compileSingleCall(compiledCall, context);
            })
            .flat();
    }
}

function compileCode(
    code: IFunctionCode,
    args: IReadOnlyFunctionCallArgumentCollection,
    compiler: IExpressionsCompiler): ICompiledFunctionCall {
    return {
        code: compiler.compileExpressions(code.do, args),
        revertCode: compiler.compileExpressions(code.revert, args),
    };
}

function compileArgs(
    argsToCompile: IReadOnlyFunctionCallArgumentCollection,
    args: IReadOnlyFunctionCallArgumentCollection,
    compiler: IExpressionsCompiler,
    ): IReadOnlyFunctionCallArgumentCollection {
    const compiledArgs = new FunctionCallArgumentCollection();
    for (const parameterName of argsToCompile.getAllParameterNames()) {
        const argumentValue = argsToCompile.getArgument(parameterName).argumentValue;
        const compiledValue = compiler.compileExpressions(argumentValue, args);
        const newArgument = new FunctionCallArgument(parameterName, compiledValue);
        compiledArgs.addArgument(newArgument);
    }
    return compiledArgs;
}

function merge(codeParts: readonly string[]): string {
    return codeParts
        .filter((part) => part?.length > 0)
        .join('\n');
}

function ensureThatCallArgumentsExistInParameterDefinition(
    func: ISharedFunction,
    args: IReadOnlyFunctionCallArgumentCollection): void {
    const callArgumentNames = args.getAllParameterNames();
    const functionParameterNames = func.parameters.all.map((param) => param.name) || [];
    const unexpectedParameters = findUnexpectedParameters(callArgumentNames, functionParameterNames);
    throwIfNotEmpty(func.name, unexpectedParameters, functionParameterNames);
}

function findUnexpectedParameters(
    callArgumentNames: string[],
    functionParameterNames: string[]): string[] {
    if (!callArgumentNames.length && !functionParameterNames.length) {
        return [];
    }
    return callArgumentNames
        .filter((callParam) => !functionParameterNames.includes(callParam));
}

function throwIfNotEmpty(
    functionName: string,
    unexpectedParameters: string[],
    expectedParameters: string[]) {
    if (!unexpectedParameters.length) {
        return;
    }
    throw new Error(
        `Function "${functionName}" has unexpected parameter(s) provided: ` +
        `"${unexpectedParameters.join('", "')}"` +
        '. Expected parameter(s): ' +
        (expectedParameters.length ? `"${expectedParameters.join('", "')}"` : 'none'),
    );
}
