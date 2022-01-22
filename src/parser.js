import { TOK_TYPE } from "./lex.js";
import assert from "assert";

export default function parse(toks) {
	let asm = "format ELF64 executable 3\n";
	let data = "segment readable writable\n" +
	            "mem rb 100\n" + 
	            "mem_ptr dq 0";
	let text = "segment readable executable\n" +
			    "entry main\n";

	let contexts = [];
	let identifiers = [];
	let return_addrs = [];
	let var_map = new Map();
	let var_offset = 0;
	let addr_count = 0;
	while (toks.length > 0) {
		let tok = toks.shift();

		switch (tok.type) {
			case TOK_TYPE.FUNC:
				let func_name = toks.shift();
				text += `${func_name.val}:\n`;
				contexts.push({type: TOK_TYPE.FUNC, val: func_name.val});
				break;
			case TOK_TYPE.DEF_OPEN:
			    if (contexts.at(-1).type !== TOK_TYPE.FUNC) {
                    text += `addr_${addr_count}:\n`;			        
			    }
				contexts.push({type: TOK_TYPE.DEF_OPEN, val: null});
				break;
			case TOK_TYPE.DEF_CLOSE:
			    let open = contexts.pop()
				if (open.type !== TOK_TYPE.FUNC && open.type !== TOK_TYPE.DEF_OPEN) {
					throw new Error(`Unmatched parenthesis, got ${open.type}!`);
				}
				if (return_addrs.length > 0) {
			        let gobacktothisaddr = return_addrs.pop()
				    text += `    jmp addr_${gobacktothisaddr}\n` +
				            `addr_${gobacktothisaddr}:\n`;
				}
				break;
			case TOK_TYPE.PUSH:
                assert(toks.length > 1, "Nothing to push!");
                assert(toks[0].type === TOK_TYPE.INT, `Cannot push ${toks[0].type}, only INT`); 
                // text += `    push ${toks.shift().val}\n`;
                break;
			case TOK_TYPE.FUNC_CALL:
			    let func_iden = toks.shift();
			    text += `    add [mem_ptr], ${var_offset}\n`    +
			            `    call ${func_iden.val}\n` +
			            `    sub [mem_ptr], ${var_offset}\n`;
                break;
    		case TOK_TYPE.INT_TYPE:
			    if (toks[0].type === TOK_TYPE.IDENTIFIER) {
                    identifiers.push(toks.shift());
			    }
			    break;
			case TOK_TYPE.IDENTIFIER:
			    if (var_map.has(tok.val)) {
			        identifiers.push(tok);
			    }
			    break;
			case TOK_TYPE.ASSIGN:
			    let iden = identifiers.pop();
			    let value = toks.shift();
			    text += "    mov rax, [mem_ptr]\n" +
			            `    add rax, ${var_map.has(iden.val) ? var_map.get(iden.val).start : var_offset}\n` +
			            `    mov dword[mem + rax], ${value.val}\n`;
			    var_map.set(iden.val, {start: var_offset, size: 4});
			    var_offset += 4;
			    break;
			case TOK_TYPE.RETURN:
			    let popped = contexts.pop();
			    assert(popped !== undefined, "Stray Return!");
			    assert(popped.type === TOK_TYPE.DEF_OPEN, "Invalid Syntax!");
				if (contexts.at(-1).val === "main") {
					text += "    mov rax, 60\n" +
							`    mov rdi, ${toks[0].type == TOK_TYPE.INT ? toks[0].val : 69420}\n` + 
							"    syscall\n";
                    break;
				}
	            text += "    ret\n";
				break;
            case TOK_TYPE.IF:
                let operand_a = toks.shift();
                let operator = toks.shift();
                let operand_b = toks.shift();
			    assert(operand_a.type == TOK_TYPE.IDENTIFIER || operand_a.type == TOK_TYPE.INT, "Invalid operand type!");
			    assert(operand_b.type == TOK_TYPE.IDENTIFIER || operand_b.type == TOK_TYPE.INT, "Invalid operand type!");                
                assert(operator.type == TOK_TYPE.EQ, "Invalid Operator!");
                if (operand_a.type == TOK_TYPE.IDENTIFIER) {
                    text += `    mov rax, [mem_ptr]\n` +
                            `    add rax, ${var_map.get(operand_a.val).start}\n` +
                            `    mov edx, dword[mem + rax]\n`;
                } else {
                    text += `    mov edx, ${operand_a.val}\n`;
                }
                if (operand_b.type == TOK_TYPE.IDENTIFIER) {
                    text += "    mov rax, [mem_ptr]\n" +
                            `    add rax, ${var_map.get(operand_b.val).start}\n` +
                            `    mov ecx, dword[mem + rax]\n`;
                } else {
                    text += `    mov ecx, ${operand_b.val}\n`;
                }
                return_addrs.push(addr_count);
                addr_count += 1;
                text += `    cmp edx, ecx\n` +
                        `    jmp addr_${addr_count}\n`;
                break;
		}
	}

	asm += text + data;
	return asm;
}