# Contribuindo com ARquest

Obrigado por ajudar. Para facilitar a revisão e a reprodução dos resultados:

1. Abra uma issue para discutir mudanças grandes ou novos recursos.
2. Crie uma branch e mantenha cada pull request focado em uma mudança.
3. Descreva o comportamento antes/depois, os dispositivos afetados e como testou.
4. Rode `npm test` dentro de `pc_server` para alterações de servidor, interação ou AR web.
5. Para mudanças Android, compile com `powershell -File apps/android/build.ps1` e informe o modelo do aparelho e a versão do Android usados no teste.
6. Não envie certificados, chaves, tokens de pareamento, dados pessoais, `node_modules`, builds ou dependências binárias que os scripts baixam.
7. Preserve os avisos e licenças de código, modelos, bibliotecas e ferramentas de terceiros.

Pull requests são revisados antes de entrar na branch principal. Se uma mudança não puder ser testada em hardware, diga isso claramente no PR.
