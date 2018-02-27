import * as Mustache from 'mustache';
import * as _ from 'lodash';
import { HttpRequest } from '../proxy-server/HttpRequest';
import * as fs from 'fs';
import * as path from 'path';
import { IMethodCall, ISpecView, IStubMethod, IStubView } from './templateTypes';
import { NamingUtils } from './NamingUtils';


const dockerNames = require('docker-names');

const templateDirPath = path.resolve(__dirname, '..', '..', 'src', 'templates');
const outputDirPath = path.resolve(__dirname, '..', '..', 'src', 'generated-tests');

const camel = require('to-camel-case');

class Templates {
    public static TemplateStub = fs.readFileSync(path.join(templateDirPath, 'TemplateStub.ts')).toString();
    public static TemplateSpec = fs.readFileSync(path.join(templateDirPath, 'TemplateSpec.ts')).toString();
}

export class MochaGenerator {

    constructor() {
        this.initMustacheTemplates();
    }

    public generate(requests: HttpRequest[]) {
        // console.log(requests);

        const stubView = this.generateRequestStub(requests);
        this.generateRequestSpec(stubView);
    }

    private generateRequestStub(requests: HttpRequest[]): IStubView {

        const methods = this.generateMethodsFromRequests(requests);

        const classPrefix = this.generateClassPrefix();
        const className = NamingUtils.getStubClassName(classPrefix);
        const fileName = `${className}.ts`;

        const stubView: IStubView = {
            classPrefix,
            className,
            stubMethods: methods,
        };
        this.render(fileName, Templates.TemplateStub, stubView);

        return stubView;
    }

    private generateRequestSpec(stubView: IStubView) {

        const stubMethodCalls = this.generateMethodsCall(stubView);
        const fileName = `${NamingUtils.getSpecClassName(this.generateClassPrefix())}.ts`;
        const stubImport = `import {${stubView.className}} from "./${stubView.className}";`;

        const specView: ISpecView = {
            stubInstantiation: `const stub = new ${stubView.className}();`,
            stubImport,
            stubMethodCalls,
        };

        this.render(fileName, Templates.TemplateSpec, specView);

    }

    private render(fileName: string, template: string, variables: any) {
        const output = Mustache.render(template, variables);
        fs.writeFileSync(path.join(outputDirPath, fileName), output);
    }

    private generateClassPrefix() {
        const raw = camel(dockerNames.getRandomName());
        return raw.charAt(0).toLocaleUpperCase() + raw.slice(1);
    }

    private generateMethodsFromRequests(requests: HttpRequest[]): IStubMethod[] {
        return _.map(requests, (req) => {
            return {
                nameSuffix: camel(req.url),
                params: 'arg0?: any, arg1?: any, arg2?: any',
                returnType: ': HttpRequest', // : is mandatory
                returnValue: JSON.stringify(req, null, 2),
            } as IStubMethod;
        });
    }

    private initMustacheTemplates() {
        const customTags = ['/*<', '>*/'];
        Mustache.parse(Templates.TemplateSpec, customTags);
        Mustache.parse(Templates.TemplateStub, customTags);
    }

    private generateMethodsCall(stubView: IStubView): IMethodCall[] {
        const methodCalls: IMethodCall[] = [];
        _.forEach(stubView.stubMethods, (method: IStubMethod) => {
            methodCalls.push({ methodCall: NamingUtils.getMethodCall(method.nameSuffix) });
        });
        return methodCalls;
    }
}
