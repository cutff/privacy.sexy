import 'mocha';
import { expect } from 'chai';
import { parseCategory } from '@/application/Parser/CategoryParser';
import { parseScript } from '@/application/Parser/Script/ScriptParser';
import { parseDocUrls } from '@/application/Parser/DocumentationParser';
import { ScriptCompilerStub } from '@tests/unit/stubs/ScriptCompilerStub';
import { ScriptDataStub } from '@tests/unit/stubs/ScriptDataStub';
import { CategoryCollectionParseContextStub } from '@tests/unit/stubs/CategoryCollectionParseContextStub';
import { LanguageSyntaxStub } from '@tests/unit/stubs/LanguageSyntaxStub';
import { CategoryDataStub } from '@tests/unit/stubs/CategoryDataStub';

describe('CategoryParser', () => {
    describe('parseCategory', () => {
        describe('invalid category', () => {
            it('throws when undefined', () => {
                // arrange
                const expectedMessage = 'category is null or undefined';
                const category = undefined;
                const context = new CategoryCollectionParseContextStub();
                // act
                const act = () => parseCategory(category, context);
                // assert
                expect(act).to.throw(expectedMessage);
            });
            it('throws when children are empty', () => {
                // arrange
                const categoryName = 'test';
                const expectedMessage = `category has no children: "${categoryName}"`;
                const category = new CategoryDataStub()
                    .withName(categoryName)
                    .withChildren([]);
                const context = new CategoryCollectionParseContextStub();
                // act
                const act = () => parseCategory(category, context);
                // assert
                expect(act).to.throw(expectedMessage);
            });
            it('throws when children are undefined', () => {
                // arrange
                const categoryName = 'test';
                const expectedMessage = `category has no children: "${categoryName}"`;
                const category = new CategoryDataStub()
                    .withName(categoryName)
                    .withChildren(undefined);
                const context = new CategoryCollectionParseContextStub();
                // act
                const act = () => parseCategory(category, context);
                // assert
                expect(act).to.throw(expectedMessage);
            });
            it('throws when name is empty or undefined', () => {
                // arrange
                const expectedMessage = 'category has no name';
                const invalidNames = ['', undefined];
                invalidNames.forEach((invalidName) => {
                    const category = new CategoryDataStub()
                        .withName(invalidName);
                    const context = new CategoryCollectionParseContextStub();
                    // act
                    const act = () => parseCategory(category, context);
                    // assert
                    expect(act).to.throw(expectedMessage);
                });
            });
        });
        it('throws when context is undefined', () => {
            // arrange
            const expectedError = 'undefined context';
            const context = undefined;
            const category = new CategoryDataStub();
            // act
            const act = () => parseCategory(category, context);
            // assert
            expect(act).to.throw(expectedError);
        });
        it('returns expected docs', () => {
            // arrange
            const url = 'https://privacy.sexy';
            const expected = parseDocUrls({ docs: url });
            const category = new CategoryDataStub()
                .withDocs(url);
            const context = new CategoryCollectionParseContextStub();
            // act
            const actual = parseCategory(category, context).documentationUrls;
            // assert
            expect(actual).to.deep.equal(expected);
        });
        describe('parses expected subscript', () => {
            it('single script with code', () => {
                // arrange
                const script = ScriptDataStub.createWithCode();
                const context = new CategoryCollectionParseContextStub();
                const expected = [ parseScript(script, context) ];
                const category = new CategoryDataStub()
                    .withChildren([ script ]);
                // act
                const actual = parseCategory(category, context).scripts;
                // assert
                expect(actual).to.deep.equal(expected);
            });
            it('single script with function call', () => {
                // arrange
                const script = ScriptDataStub.createWithCall();
                const compiler = new ScriptCompilerStub()
                    .withCompileAbility(script);
                const context = new CategoryCollectionParseContextStub()
                    .withCompiler(compiler);
                const expected = [ parseScript(script, context) ];
                const category = new CategoryDataStub()
                    .withChildren([ script ]);
                // act
                const actual = parseCategory(category, context).scripts;
                // assert
                expect(actual).to.deep.equal(expected);
            });
            it('multiple scripts with function call and code', () => {
                // arrange
                const callableScript = ScriptDataStub.createWithCall();
                const scripts = [ callableScript, ScriptDataStub.createWithCode() ];
                const category = new CategoryDataStub()
                    .withChildren(scripts);
                const compiler = new ScriptCompilerStub()
                    .withCompileAbility(callableScript);
                const context = new CategoryCollectionParseContextStub()
                    .withCompiler(compiler);
                const expected = scripts.map((script) => parseScript(script, context));
                // act
                const actual = parseCategory(category, context).scripts;
                // assert
                expect(actual).to.deep.equal(expected);
            });
            it('script is created with right context', () => { // test through script validation logic
                // arrange
                const commentDelimiter = 'should not throw';
                const duplicatedCode = `${commentDelimiter} duplicate-line\n${commentDelimiter} duplicate-line`;
                const parseContext = new CategoryCollectionParseContextStub()
                    .withSyntax(new LanguageSyntaxStub().withCommentDelimiters(commentDelimiter));
                const category = new CategoryDataStub()
                    .withChildren([
                        new CategoryDataStub()
                            .withName('sub-category')
                            .withChildren([
                                ScriptDataStub
                                    .createWithoutCallOrCodes()
                                    .withCode(duplicatedCode),
                            ]),
                    ]);
                // act
                const act = () => parseCategory(category, parseContext).scripts;
                // assert
                expect(act).to.not.throw();
            });
        });
        it('returns expected subcategories', () => {
            // arrange
            const expected  = [ new CategoryDataStub()
                .withName('test category')
                .withChildren([ ScriptDataStub.createWithCode() ]),
            ];
            const category = new CategoryDataStub()
                .withName('category name')
                .withChildren(expected);
            const context = new CategoryCollectionParseContextStub();
            // act
            const actual = parseCategory(category, context).subCategories;
            // assert
            expect(actual).to.have.lengthOf(1);
            expect(actual[0].name).to.equal(expected[0].category);
            expect(actual[0].scripts.length).to.equal(expected[0].children.length);
        });
    });
});
