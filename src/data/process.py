# Importing Libraries
import json
import argparse
from sklearn.neighbors import NearestNeighbors
from scipy.sparse import csr_matrix
import numpy as np
import pandas as pd
import sklearn
import sys
import matplotlib.pyplot as plt
import seaborn as sns
# import warnings
import pymongo
import os
from dotenv import load_dotenv

load_dotenv()

client = pymongo.MongoClient(os.environ.get('MONGODB_URI'))
db = client["NextStore"]

# warnings.simplefilter(action='ignore', category=FutureWarning)


ratings_collection = db["ratings"]
ratings = pd.DataFrame(list(ratings_collection.find()))

# PDs_collection = db["PDs"]
# PDs = pd.DataFrame(list(PDs_collection.find()))

# Get data from all collections
collections = ["airs", "cookers", "freezers", "fridges", "fryers",
               "robots", "televisions", "washingmachines", "waterheaters"]
allData = []

for collection_name in collections:
    collection = db[collection_name]
    data = list(collection.find())
    allData.extend(data)

# Convert to DataFrame
PDs = pd.DataFrame(allData)
# print(PDs)


# input_data = sys.stdin.read()
# data = json.loads(input_data)
# user_id = data['userId']

print(json.dumps({"userId": PDs}))
