"""LibreOffice UNO：更新目录与全部域，另存 docx，并导出 PDF。  python3 lo_update.py file.docx"""
import os, sys, time, subprocess, uno
from com.sun.star.beans import PropertyValue

def prop(n, v):
    p = PropertyValue(); p.Name = n; p.Value = v; return p

path = os.path.abspath(sys.argv[1])
port = 2002 + os.getpid() % 500
proc = subprocess.Popen(['soffice', '--headless', '--invisible', '--norestore', '--nologo',
                         f'--accept=socket,host=127.0.0.1,port={port};urp;', f'-env:UserInstallation=file:///tmp/lo_profile_{port}'],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
ctx = None
local = uno.getComponentContext()
resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
for _ in range(120):
    try:
        ctx = resolver.resolve(f'uno:socket,host=127.0.0.1,port={port};urp;StarOffice.ComponentContext'); break
    except Exception:
        time.sleep(0.5)
smgr = ctx.ServiceManager
desktop = smgr.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(path), '_blank', 0, (prop('Hidden', True),))
for _ in range(2):
    idx = doc.getDocumentIndexes()
    for i in range(idx.getCount()):
        idx.getByIndex(i).update()
    doc.getTextFields().refresh()
    doc.refresh()
doc.storeToURL(uno.systemPathToFileUrl(path), (prop('FilterName', 'MS Word 2007 XML'),))
pdf = os.path.splitext(path)[0] + '.pdf'
doc.storeToURL(uno.systemPathToFileUrl(pdf), (prop('FilterName', 'writer_pdf_Export'),))
doc.close(True)
try:
    desktop.terminate()
except Exception:
    pass
proc.wait(timeout=60)
print('updated', path, '->', pdf)
