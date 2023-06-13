#!/usr/bin/python
# -*- coding: utf-8 -*-

import os,sys
import shutil
import datetime
import re
import os
import string
import re,xml.dom.minidom,codecs
from optparse import OptionParser
changenum = 0
changefilenum = 0
def parsedir(dstdir):
	print(dstdir)
	files = os.listdir(dstdir)
	for file in files:
		if os.path.isdir(dstdir  + "/" +  file):
			parsedir(dstdir + "/" + file)
			continue
		#elif re.search(".lua$",file) != None or re.search(".xml$",file) != None or re.search(".example$",file) != None:
		elif re.search("node_modules/",file) != None or re.search("resources",dstdir) != None:
			continue
		elif re.search("\.sh$",file) != None or re.search("\.sol$",file) != None or re.search("\.ts$",file) != None:
			#print(file)
			changefile(dstdir,file)

def changefile1(dstdir,dstfile):
	filename = dstdir + "/" + dstfile
	assert(os.system('cat %s |sed -e "s/nettask.RegisterPlatCommandType(\\(.*\\,\\(.*\\)_value/nettask.RegisterCommandType(byte(\\1,\\2_value/g" > %s.bak'%(filename,filename)) == 0)
	#assert(os.system('cat %s |sed -e "s/nettask.RegisterServerCommandType(\\(.*\\,\\(.*\\)_value/nettask.RegisterCommandType(byte(\\1,\\2_value/g" > %s.bak'%(filename,filename)) == 0)
	assert(os.system('mv %s.bak %s'%(filename,filename)) == 0)

def changefile(dstdir,dstfile):
    global changenum
    global changefilenum
    #print(dstfile)
    dst = open(dstdir + "/" + dstfile,"r")
    dstlines = dst.readlines()
    dst.close()
    needchange = False
    for dstline in dstlines:
        tmp = dstline
        #tmp = tmp.replace('const google::protobuf::Message* msg = NULL;','google::protobuf::Message* msg = NULL;')
        #tmp = tmp.replace('Cmd::Record::WRITEBACK_TIMETICK','GameSmd::WRITEBACK_TIMETICK')
        #tmp = tmp.replace('>name','>name.c_str()')
        tmp=tmp.replace('CutoffSlippageThresholdX96','CutoffSlippageThreshold')
        tmp=tmp.replace('GreenLightSlippageThresholdX96','GreenLightSlippageThreshold')
        if tmp != dstline:
            #print(tmp)
            needchange = True
            break
    if needchange == False:
        return
    print(dstfile)
    dst = open(dstdir + "/" + dstfile,"w")
    i = 0
    j = 0
    first = True
    for dstline in dstlines:
        tmp = dstline
        tmp=tmp.replace('CutoffSlippageThresholdX96','CutoffSlippageThreshold')
        tmp=tmp.replace('GreenLightSlippageThresholdX96','GreenLightSlippageThreshold')
        if tmp != dstline:
            print(tmp)
            changenum = changenum + 1
            dstline = tmp
            if first == True:
                changefilenum = changefilenum + 1
                first = False
        dst.write(dstline)

    dst.close()



def main():
	parsedir("./")
	print("change Total file num:",changefilenum)
	print("change Total num:",changenum)

main()
